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

function setup({ sendResult = "ok", trackResult = "ok" } = {}) {
  let now = 10000,
    nextTimer = 1;
  const timers = new Map(),
    handlers = new Map();
  const errors = [];
  const sent = [],
    tracked = [],
    states = [];
  let presences = {},
    untracked = 0;
  const channel = {
    on(type, filter, callback) {
      handlers.set(`${type}:${filter.event}`, callback);
      return this;
    },
    send(message) {
      sent.push({ ...message, at: now });
      return sendResult instanceof Error
        ? Promise.reject(sendResult)
        : Promise.resolve(sendResult);
    },
    track(payload) {
      tracked.push(payload);
      return trackResult instanceof Error
        ? Promise.reject(trackResult)
        : Promise.resolve(trackResult);
    },
    untrack() {
      untracked++;
      return Promise.resolve("ok");
    },
    presenceState() {
      return presences;
    },
  };
  const { createChatActivity } = moduleAt(
    "lib/chat/activity.ts",
    {},
    {
      Date: { now: () => now },
      setTimeout(fn, delay) {
        const id = nextTimer++;
        timers.set(id, { fn, due: now + delay });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
  );
  const activity = createChatActivity(
    channel,
    "me",
    "other",
    "my-tab",
    (state) => states.push(state),
    (error) => errors.push(error),
  );
  function advance(ms) {
    const target = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > target) break;
      now = next[1].due;
      timers.delete(next[0]);
      next[1].fn();
    }
    now = target;
  }
  function presence(value) {
    presences = value;
    handlers.get("presence:sync")();
  }
  function typing(payload) {
    handlers.get("broadcast:typing")({ payload });
  }
  return {
    activity,
    errors,
    sent,
    tracked,
    states,
    advance,
    presence,
    typing,
    timers,
    untracked: () => untracked,
  };
}
test("typing is throttled to two seconds and stops three seconds after last input", () => {
  const x = setup();
  x.activity.subscribed();
  x.activity.input(true);
  for (let i = 0; i < 5; i++) {
    x.advance(300);
    x.activity.input(true);
  }
  assert.equal(x.sent.length, 1);
  x.advance(500);
  assert.equal(x.sent.length, 2);
  assert.equal(x.sent[1].at - x.sent[0].at, 2000);
  x.advance(2499);
  assert.equal(x.sent.length, 2);
  x.advance(1);
  assert.equal(x.sent.at(-1).payload.typing, false);
  assert.equal(x.sent.at(-1).at, 14500);
  assert.equal(x.sent[0].event, "typing");
  assert.equal(Object.hasOwn(x.sent[0].payload, "body"), false);
});
test("continuous typing stays throttled and has no perpetual heartbeat", () => {
  const x = setup();
  x.activity.subscribed();
  for (let i = 0; i < 100; i++) {
    x.activity.input(true);
    x.advance(100);
  }
  const starts = x.sent.filter((event) => event.payload.typing);
  for (let i = 1; i < starts.length; i++)
    assert.ok(starts[i].at - starts[i - 1].at >= 2000);
  x.advance(3000);
  const length = x.sent.length;
  x.advance(20000);
  assert.equal(x.sent.length, length);
  assert.equal(x.sent.at(-1).payload.typing, false);
});
test("clear, submit or blur stop immediately and cancel trailing typing", () => {
  const x = setup();
  x.activity.subscribed();
  x.activity.input(true);
  x.advance(200);
  x.activity.input(true);
  x.activity.input(false);
  assert.equal(x.sent.at(-1).payload.typing, false);
  const count = x.sent.length;
  x.advance(4000);
  assert.equal(x.sent.length, count);
  x.activity.input(true);
  x.activity.stop();
  assert.equal(x.sent.at(-1).payload.typing, false);
});
test("disconnected typing is never sent and presence is re-tracked after reconnect", () => {
  const x = setup();
  x.activity.input(true);
  assert.equal(x.sent.length, 0);
  x.activity.subscribed();
  x.activity.input(true);
  x.activity.disconnected();
  const count = x.sent.length;
  x.advance(5000);
  x.activity.input(true);
  assert.equal(x.sent.length, count);
  x.activity.subscribed();
  assert.equal(x.tracked.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(x.tracked[0])), {
    user_id: "me",
    session_id: "my-tab",
  });
});
test("online is specific to the other participant and survives one tab leaving", () => {
  const x = setup();
  x.activity.subscribed();
  x.presence({ me: [{ user_id: "me" }], stranger: [{ user_id: "stranger" }] });
  assert.equal(x.states.length, 0);
  x.presence({
    other: [
      { user_id: "other", session_id: "a" },
      { user_id: "other", session_id: "b" },
    ],
  });
  assert.equal(x.states.at(-1).online, true);
  x.presence({ other: [{ user_id: "other", session_id: "b" }] });
  assert.equal(x.states.at(-1).online, true);
  x.presence({});
  assert.equal(x.states.at(-1).online, false);
});
test("remote typing expires if stop is lost and ignores stale, own, or malformed events", () => {
  const x = setup();
  x.activity.subscribed();
  const event = {
    user_id: "other",
    session_id: "a",
    typing: true,
    sequence: 1,
  };
  x.typing({ ...event, user_id: "me" });
  x.typing({ ...event, typing: "true" });
  assert.equal(x.states.length, 0);
  x.typing(event);
  assert.equal(x.states.at(-1).typing, true);
  x.advance(3000);
  assert.equal(x.states.at(-1).typing, false);
  x.typing(event);
  assert.equal(x.states.at(-1).typing, false);
  x.typing({ ...event, sequence: 2 });
  assert.equal(x.states.at(-1).typing, true);
  x.typing({ ...event, typing: false, sequence: 3 });
  assert.equal(x.states.at(-1).typing, false);
});
test("typing in a second tab remains visible when the first stops or leaves", () => {
  const x = setup();
  x.activity.subscribed();
  for (const id of ["a", "b"])
    x.typing({ user_id: "other", session_id: id, typing: true, sequence: 1 });
  x.typing({ user_id: "other", session_id: "a", typing: false, sequence: 2 });
  assert.equal(x.states.at(-1).typing, true);
  x.presence({ other: [{ user_id: "other", session_id: "b" }] });
  assert.equal(x.states.at(-1).typing, true);
  x.presence({});
  assert.equal(x.states.at(-1).typing, false);
});
test("disposal untracks and clears every timer; late events cannot update UI", () => {
  const x = setup();
  x.activity.subscribed();
  x.activity.input(true);
  x.typing({ user_id: "other", session_id: "a", typing: true, sequence: 1 });
  x.activity.dispose();
  assert.equal(x.untracked(), 1);
  assert.equal(x.timers.size, 0);
  const count = x.states.length;
  x.activity.subscribed();
  x.activity.input(true);
  x.typing({ user_id: "other", session_id: "a", typing: true, sequence: 2 });
  x.advance(5000);
  assert.equal(x.states.length, count);
});

test("typing and presence rejected/non-ok results reach visible feedback", async () => {
  for (const result of ["error", "timed out", new Error("offline")]) {
    const x = setup({ sendResult: result, trackResult: result });
    x.activity.subscribed();
    x.activity.input(true);
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(x.errors.some((message) => message.includes("unavailable")));
    x.activity.dispose();
  }
});
