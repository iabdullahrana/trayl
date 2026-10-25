import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function moduleAt(path, dependencies = {}, globals = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const exports = {};
  runInNewContext(outputText, {
    exports,
    ...globals,
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return exports;
}

const types = moduleAt("lib/chat/types.ts");
const requestId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";
function safety({
  access = true,
  insertError = null,
  rpc = { data: "available", error: null },
} = {}) {
  const calls = [];
  const client = {
    from: (table) => ({
      insert: async (row) => {
        calls.push({ table, row });
        return { error: insertError };
      },
    }),
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      return rpc;
    },
  };
  const api = moduleAt("app/chat/safety-actions.ts", {
    "@/lib/chat/server": {
      getChatAccess: async () =>
        access
          ? { user: { id: "me" }, otherId: "peer", supabase: client }
          : null,
    },
    "@/lib/chat/types": types,
    "next/cache": { revalidatePath: () => {} },
  });
  return { ...api, calls };
}
test("reports derive reporter identity, support empty conversations and trim reasons", async () => {
  const api = safety();
  assert.ok(
    (await api.reportChat(requestId, null, "  Unsafe behavior  ")).success,
  );
  assert.equal(api.calls[0].row.reporter_id, "me");
  assert.equal(api.calls[0].row.message_id, null);
  assert.equal(api.calls[0].row.reason, "Unsafe behavior");
  assert.ok(
    (await api.reportChat(requestId, messageId, "Message report")).success,
  );
  assert.equal(api.calls[1].row.request_id, requestId);
  assert.equal(api.calls[1].row.message_id, messageId);
});
test("invalid reasons, malformed message IDs and nonparticipants never insert reports", async () => {
  const api = safety();
  for (const [message, reason] of [
    [null, "  "],
    [null, "a".repeat(2001)],
    ["bad-id", "reason"],
  ])
    assert.ok((await api.reportChat(requestId, message, reason)).error);
  assert.equal(api.calls.length, 0);
  const denied = safety({ access: false });
  assert.ok((await denied.reportChat(requestId, null, "reason")).error);
  assert.ok((await denied.blockChatUser(requestId)).error);
  assert.equal(denied.calls.length, 0);
});
test("blocking derives both identities and duplicate blocks/reports are idempotent", async () => {
  const api = safety({ insertError: { code: "23505" } });
  assert.ok((await api.blockChatUser(requestId)).success);
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls[0].row)), {
    blocker_id: "me",
    blocked_id: "peer",
  });
  assert.ok((await api.reportChat(requestId, messageId, "reason")).success);
  assert.ok(
    (await safety({ insertError: { code: "42501" } }).blockChatUser(requestId))
      .error,
  );
});
test("chat availability fails closed on RPC failures or unexpected values", async () => {
  for (const rpc of [
    { data: null, error: {} },
    { data: "unknown", error: null },
  ]) {
    const result = await safety({ rpc }).loadChatSafety(requestId);
    assert.equal(result.state, "unavailable");
    assert.ok(result.error);
  }
  for (const state of ["available", "blocked", "locked", "unavailable"])
    assert.equal(
      (await safety({ rpc: { data: state } }).loadChatSafety(requestId)).state,
      state,
    );
});
test("rate limits, blocks and expired chats return helpful send errors", () => {
  const { chatSafetyError } = moduleAt("lib/chat/safety.ts");
  assert.match(
    chatSafetyError({ message: "CHAT_RATE_LIMIT" }),
    /30 messages per minute/,
  );
  assert.match(chatSafetyError({ message: "CHAT_BLOCKED" }), /can't send/);
  assert.match(chatSafetyError({ message: "CHAT_LOCKED" }), /seven days/);
  assert.equal(chatSafetyError({ message: "Other failure" }), undefined);
});
function moderation({ allowed = true, data = true } = {}) {
  const calls = [];
  const api = moduleAt("app/admin/report-actions.ts", {
    "@/lib/admin/server": {
      requireAdmin: async () => {
        if (!allowed) throw Error("denied");
        return {
          supabase: {
            rpc: async (name, args) => {
              calls.push({ name, args });
              return { data };
            },
          },
        };
      },
    },
    "@/lib/chat/types": types,
    "next/cache": { revalidatePath: () => {} },
  });
  return { ...api, calls };
}
test("moderation requires admin and derives deactivation target from the report in SQL", async () => {
  const form = new FormData();
  form.set("reportId", messageId);
  form.set("action", "deactivate");
  form.set("targetUserId", "forged");
  const denied = moderation({ allowed: false });
  await assert.rejects(denied.moderateReport({}, form), /denied/);
  assert.equal(denied.calls.length, 0);
  const api = moderation();
  assert.ok((await api.moderateReport({}, form)).success);
  assert.equal(api.calls[0].name, "admin_deactivate_report_user");
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls[0].args)), {
    report_id: messageId,
  });
  form.set("action", "review");
  assert.ok((await api.moderateReport({}, form)).success);
  assert.equal(api.calls[1].name, "admin_review_report");
  assert.ok((await moderation({ data: false }).moderateReport({}, form)).error);
});
function mediaRoute({
  throwRpc = false,
  allowed = true,
  message = { media_path: "private/reported.pdf", media_name: "reported.pdf" },
} = {}) {
  const calls = [];
  class ResponseMock {
    constructor(body, options) {
      this.body = body;
      Object.assign(this, options);
    }
    static redirect(url, options) {
      return new ResponseMock(url, options);
    }
  }
  const api = moduleAt("app/admin/reports/[reportId]/media/route.ts", {
    "next/server": { NextResponse: ResponseMock },
    "@/lib/chat/types": types,
    "@/lib/admin/server": {
      requireAdmin: async () => {
        if (!allowed) throw Error("denied");
        return {
          supabase: {
            rpc: async (name, args) => {
              calls.push({ name, args });
              if (throwRpc) throw Error("offline");
              return { data: message ? [message] : [] };
            },
            storage: {
              from: (bucket) => ({
                createSignedUrl: async (path, expires, options) => {
                  calls.push({ bucket, path, expires, options });
                  return {
                    data: { signedUrl: "https://example.invalid/signed" },
                  };
                },
              }),
            },
          },
        };
      },
    },
  });
  return { ...api, calls };
}
test("admin media route signs only open-report RPC results with a short noncached URL", async () => {
  const api = mediaRoute();
  const response = await api.GET({}, { params: { reportId: messageId } });
  assert.equal(api.calls[0].name, "admin_report_message");
  assert.equal(api.calls[1].path, "private/reported.pdf");
  assert.equal(api.calls[1].expires, 60);
  assert.equal(response.status, 302);
  assert.match(response.headers["Cache-Control"], /no-store/);
  const closed = mediaRoute({ message: null });
  assert.equal(
    (await closed.GET({}, { params: { reportId: messageId } })).status,
    404,
  );
  assert.equal(closed.calls.length, 1);
  const denied = mediaRoute({ allowed: false });
  await assert.rejects(
    denied.GET({}, { params: { reportId: messageId } }),
    /denied/,
  );
  assert.equal(denied.calls.length, 0);
});

test("reported attachment transport exceptions return readable no-store feedback", async () => {
  const api = mediaRoute({ throwRpc: true });
  const response = await api.GET({}, { params: { reportId: messageId } });
  assert.equal(response.status, 503);
  assert.match(response.body, /retry/);
  assert.match(response.headers["Cache-Control"], /no-store/);
});
