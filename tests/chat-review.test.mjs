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

test("visual viewport resize/pan follows keyboard bounds and removes its listeners", () => {
  const { bindChatViewport } = moduleAt("lib/chat/viewport.ts");
  const listeners = new Map();
  const viewport = {
    height: 812,
    offsetTop: 0,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const element = {
    style: {
      removeProperty(key) {
        delete this[key];
      },
    },
  };
  const cleanup = bindChatViewport(element, viewport);
  assert.equal(element.style.height, "812px");
  viewport.height = 350;
  viewport.offsetTop = 122;
  listeners.get("resize")();
  assert.equal(element.style.height, "350px");
  assert.equal(element.style.top, "122px");
  viewport.offsetTop = 100;
  listeners.get("scroll")();
  assert.equal(element.style.top, "100px");
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(element.style.height, undefined);
});
test("channel cleanup handles rejected and non-ok removals without closing other channels", async () => {
  const { releaseChatChannel } = moduleAt("lib/chat/channel-cleanup.ts");
  let unsubscribed = 0,
    tornDown = 0;
  const channel = {
    teardown: () => {
      tornDown++;
    },
    unsubscribe: async () => {
      unsubscribed++;
      throw Error("disconnected");
    },
  };
  await releaseChatChannel({ removeChannel: async () => "ok" }, channel);
  assert.equal(unsubscribed, 0);
  await releaseChatChannel({ removeChannel: async () => "timed out" }, channel);
  await releaseChatChannel(
    {
      removeChannel: async () => {
        throw Error("offline");
      },
    },
    channel,
  );
  assert.equal(unsubscribed, 2);
  assert.equal(tornDown, 2);
});
test("an older availability response cannot undo a just-completed local block", async () => {
  let effect, resolve;
  const state = [],
    listeners = new Map();
  const response = new Promise((done) => {
    resolve = done;
  });
  const { useChatSafety } = moduleAt(
    "lib/chat/use-chat-safety.ts",
    {
      react: {
        useRef: (current) => ({ current }),
        useCallback: (fn) => fn,
        useEffect: (fn) => {
          effect = fn;
        },
        useState: (initial) => {
          const index = state.length;
          state.push(initial);
          return [
            initial,
            (value) => {
              state[index] =
                typeof value === "function" ? value(state[index]) : value;
            },
          ];
        },
      },
      "@/app/chat/safety-actions": { loadChatSafety: () => response },
    },
    {
      document: {
        visibilityState: "visible",
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
      },
      window: {
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
      },
      setInterval: () => 1,
      clearInterval: () => {},
    },
  );
  const safety = useChatSafety("chat", "available");
  const cleanup = effect();
  safety.block();
  resolve({ state: "available" });
  await new Promise((done) => setImmediate(done));
  assert.equal(state[0], "blocked");
  cleanup();
  assert.equal(listeners.size, 0);
});
test("thrown signed-URL failures produce retryable media errors, never public URLs", async () => {
  const { refreshSignedMedia } = moduleAt("lib/chat/signed-media.ts");
  const result = await refreshSignedMedia(
    new Map(),
    new Map([["a", "image"]]),
    ["a"],
    {
      createSignedUrls: async () => {
        throw Error("offline");
      },
    },
  );
  assert.match(result.a.error, /connection/);
  assert.equal(result.a.url, undefined);
});
