import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function moduleAt(path, dependencies = {}) {
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
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return exports;
}
const types = moduleAt("lib/chat/types.ts");
const id = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const message = {
  id,
  request_id: requestId,
  sender_id: "sender",
  body: "Hello",
  created_at: "2099-01-01T10:00:00.000001+00:00",
  media_path: null,
};
function client(responses) {
  const calls = [];
  return {
    calls,
    from(table) {
      const response = responses.shift();
      assert.ok(response, `Unexpected query: ${table}`);
      const operations = [];
      calls.push({ table, operations });
      const chain = {
        then: (yes, no) => Promise.resolve(response).then(yes, no),
      };
      for (const op of [
        "select",
        "eq",
        "maybeSingle",
        "single",
        "insert",
        "order",
        "limit",
        "or",
      ])
        chain[op] = (...args) => {
          operations.push([op, ...args]);
          return chain;
        };
      return chain;
    },
  };
}
function actions(responses = [], permitted = true) {
  const supabase = client(responses);
  return {
    ...moduleAt("app/chat/actions.ts", {
      "@/lib/chat/types": types,
      "@/lib/chat/safety": moduleAt("lib/chat/safety.ts"),
      "@/lib/chat/server": {
        getChatAccess: async () =>
          permitted ? { supabase, user: { id: "sender" } } : null,
      },
    }),
    calls: supabase.calls,
  };
}
test("chat sends validate text and never insert for unauthorized callers", async () => {
  const denied = actions([], false);
  assert.ok((await denied.sendMessage(requestId, id, "Hello")).error);
  assert.equal(denied.calls.length, 0);
  for (const body of ["", "   ", "a".repeat(2001)])
    assert.ok((await actions().sendMessage(requestId, id, body)).error);
});
test("chat send derives sender and confirms a retry without overwriting a message", async () => {
  const api = actions([{ data: message, error: null }]);
  assert.equal(
    (await api.sendMessage(requestId, id, " Hello ")).message.id,
    id,
  );
  const payload = api.calls[0].operations.find(([op]) => op === "insert")[1];
  assert.equal(payload.sender_id, "sender");
  assert.equal(payload.id, id);
  assert.equal(payload.body, "Hello");
  const retry = actions([{ error: { code: "23505" } }, { data: message }]);
  assert.equal(
    (await retry.sendMessage(requestId, id, "Hello")).message.id,
    id,
  );
  const clash = actions([
    { error: { code: "23505" } },
    { data: { ...message, body: "different" } },
  ]);
  assert.ok((await clash.sendMessage(requestId, id, "Hello")).error);
});
test("chat pagination uses a timestamp and ID cursor with bounded pages", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
    ...message,
    id: String(100 - i),
  }));
  const api = actions([{ data: rows }]);
  const result = await api.loadMessages(requestId, message);
  assert.equal(result.messages.length, 50);
  assert.equal(result.hasMore, true);
  assert.equal(result.messages[0].id, rows[49].id);
  const filter = api.calls[0].operations.find(([op]) => op === "or")[1];
  assert.ok(filter.includes(`id.lt.${id}`));
  assert.ok(filter.includes("created_at.lt."));
  assert.ok(
    (
      await actions().loadMessages(requestId, {
        ...message,
        created_at: "bad),id.gt.anything",
      })
    ).error,
  );
  const after = actions([{ data: [message] }]);
  await after.loadMessages(requestId, message, "after");
  assert.ok(
    after.calls[0].operations
      .find(([op]) => op === "or")[1]
      .includes(`id.gt.${id}`),
  );
});
test("Realtime and action confirmations replace optimistic messages exactly once", () => {
  const pending = { ...message, delivery: "sending" };
  const merged = types.mergeMessages([pending], [message, message]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].delivery, undefined);
  const failed = { ...pending, delivery: "failed" };
  assert.equal(types.mergeMessages([failed], [message])[0].delivery, undefined);
  const later = {
    ...message,
    id: requestId,
    created_at: "2099-01-01T10:00:00.000002+00:00",
  };
  assert.equal(types.mergeMessages([later], [message])[0].id, id);
});
test("chat authorization rejects pending requests and nonparticipants", async () => {
  for (const scenario of ["pending", "outsider", "sender", "traveller"]) {
    const supabase = client([
      {
        data: {
          sender_id: "sender",
          journey_id: id,
          status: scenario === "pending" ? "pending" : "accepted",
        },
      },
      ...(scenario === "pending"
        ? []
        : [{ data: { traveller_id: "traveller" } }]),
    ]);
    const userId = scenario === "pending" ? "sender" : scenario;
    const access = moduleAt("lib/chat/server.ts", {
      "server-only": {},
      "@/lib/supabase/server": { createClient: () => supabase },
      "@/lib/auth/user": {
        getCurrentUser: async () => ({ user: { id: userId } }),
      },
      "@/lib/chat/types": types,
      "@/lib/chat/safety": moduleAt("lib/chat/safety.ts"),
    });
    assert.equal(
      Boolean(await access.getChatAccess(requestId)),
      ["sender", "traveller"].includes(scenario),
    );
  }
});

test("day labels follow UTC across month boundaries", () => {
  const now = new Date("2099-03-01T00:30:00Z");
  assert.equal(types.dayLabel("2099-03-01T00:01:00Z", now), "Today");
  assert.equal(types.dayLabel("2099-02-28T23:59:00Z", now), "Yesterday");
  assert.equal(types.dayLabel("2099-02-27T23:59:00Z", now), "27 Feb 2099");
});

test("safety failures preserve confirmation of committed text and otherwise show the safety error", async () => {
  const error = { code: "P0001", message: "CHAT_RATE_LIMIT" };
  const retry = actions([{ error }, { data: message }]);
  assert.equal(
    (await retry.sendMessage(requestId, id, "Hello")).message.id,
    id,
  );
  const limited = actions([{ error }, { data: null }]);
  assert.match(
    (await limited.sendMessage(requestId, id, "Hello")).error,
    /30 messages per minute/,
  );
});
