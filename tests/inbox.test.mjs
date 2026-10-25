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
function queryClient(responses) {
  const calls = [];
  function query(name) {
    const result = responses.shift();
    assert.ok(result, `Unexpected query ${name}`);
    const call = { name, operations: [] };
    calls.push(call);
    const chain = { then: (yes, no) => Promise.resolve(result).then(yes, no) };
    for (const op of [
      "update",
      "eq",
      "neq",
      "is",
      "lte",
      "order",
      "range",
      "gt",
      "limit",
      "in",
    ])
      chain[op] = (...args) => {
        call.operations.push([op, ...args]);
        return chain;
      };
    return chain;
  }
  return { from: query, rpc: query, calls };
}
test("read receipts require access and batch only other unread messages in the chat", async () => {
  const client = queryClient([{ error: null }]);
  const api = moduleAt("app/chat/actions.ts", {
    "@/lib/chat/types": types,
    "@/lib/chat/safety": moduleAt("lib/chat/safety.ts"),
    "@/lib/chat/server": {
      getChatAccess: async (id) =>
        id === "allowed" ? { supabase: client, user: { id: "me" } } : null,
    },
  });
  assert.ok((await api.markChatRead("denied")).error);
  assert.equal(client.calls.length, 0);
  const result = await api.markChatRead("allowed");
  assert.ok(result.readAt);
  assert.deepEqual(JSON.parse(JSON.stringify(client.calls[0].operations)), [
    ["update", { read_at: result.readAt }],
    ["eq", "request_id", "allowed"],
    ["neq", "sender_id", "me"],
    ["is", "read_at", null],
    ["lte", "created_at", result.readAt],
  ]);
});
test("read receipt failures are reported without claiming success", async () => {
  const client = queryClient([{ error: { message: "RLS" } }]);
  const api = moduleAt("app/chat/actions.ts", {
    "@/lib/chat/types": types,
    "@/lib/chat/safety": moduleAt("lib/chat/safety.ts"),
    "@/lib/chat/server": {
      getChatAccess: async () => ({ supabase: client, user: { id: "me" } }),
    },
  });
  const result = await api.markChatRead("chat");
  assert.ok(result.error);
  assert.equal(result.readAt, undefined);
});
test("stale send confirmation cannot erase a live read receipt", () => {
  const message = {
    id: "one",
    created_at: "2026-01-01T00:00:00Z",
    read_at: "2026-01-01T00:01:00Z",
  };
  const result = types.mergeMessages(
    [message],
    [{ ...message, read_at: null }],
  );
  assert.equal(result[0].read_at, message.read_at);
});
test("inbox fetches one bounded page and preserves unread presence outside that page", async () => {
  const page = Array.from({ length: 21 }, (_, i) => ({
    request_id: String(i),
  }));
  const client = queryClient([
    { data: page },
    { data: [{ request_id: "outside", unread: 2 }] },
    { data: [{ request_id: "0", unread: 3 }] },
  ]);
  const api = moduleAt("app/messages/actions.ts", {
    "@/lib/auth/user": { getCurrentUser: async () => ({ user: { id: "me" } }) },
    "@/lib/supabase/server": { createClient: () => client },
  });
  const { snapshot } = await api.loadInbox(2);
  assert.equal(snapshot.chats.length, 20);
  assert.equal(snapshot.hasMore, true);
  assert.equal(snapshot.hasUnread, true);
  assert.equal(snapshot.page, 2);
  assert.equal(snapshot.unread["0"], 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(client.calls[0].operations.at(-1))),
    ["range", 20, 40],
  );
  assert.equal(client.calls.length, 3);
});

test("inbox errors never appear as an empty success; guests cannot query", async () => {
  let signedIn = false;
  const client = queryClient([
    { error: { message: "unavailable" } },
    { data: [] },
  ]);
  const api = moduleAt("app/messages/actions.ts", {
    "@/lib/auth/user": {
      getCurrentUser: async () => ({ user: signedIn ? { id: "me" } : null }),
    },
    "@/lib/supabase/server": { createClient: () => client },
  });
  assert.ok((await api.loadInbox()).error);
  assert.equal(client.calls.length, 0);
  signedIn = true;
  const failed = await api.loadInbox();
  assert.ok(failed.error);
  assert.equal(failed.snapshot, undefined);
});
test("media previews show category even with a caption", () => {
  const { messagePreview } = moduleAt("lib/chat/inbox.ts");
  for (const [type, expected] of [
    ["image", "Photo"],
    ["video", "Video"],
    ["document", "Document"],
  ])
    assert.equal(
      messagePreview({ last_media_type: type, last_body: "caption" }),
      expected,
    );
  assert.equal(messagePreview({ last_body: "hello" }), "hello");
});
test("hidden threads do not mark read, visible threads batch once, unmount removes listeners", async () => {
  let effect,
    cleanup,
    timer,
    marks = 0;
  const listeners = new Map();
  const doc = {
    visibilityState: "hidden",
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const win = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: () => {},
  };
  const { useReadReceipts } = moduleAt(
    "lib/chat/use-read-receipts.ts",
    {
      react: {
        useEffect: (fn) => {
          effect = fn;
        },
        useRef: (current) => ({ current }),
        useState: (value) => [value, () => {}],
      },
      "@/app/chat/actions": {
        markChatRead: async () => {
          marks++;
          return { readAt: "2026-01-01T00:01:00Z" };
        },
      },
      "@/lib/supabase/client": { createClient: () => ({}) },
    },
    {
      document: doc,
      window: win,
      Event: class {},
      setTimeout: (fn) => {
        timer = fn;
        return 1;
      },
      clearTimeout: () => {},
      setInterval: () => 2,
      clearInterval: () => {},
    },
  );
  let messages = [
    {
      id: "one",
      sender_id: "other",
      created_at: "2026-01-01T00:00:00Z",
      read_at: null,
    },
  ];
  useReadReceipts("chat", "me", messages, (update) => {
    messages = update(messages);
  });
  cleanup = effect();
  timer();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(marks, 0);
  doc.visibilityState = "visible";
  listeners.get("visibilitychange")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(marks, 1);
  assert.ok(messages[0].read_at);
  cleanup();
  assert.equal(listeners.size, 0);
});
