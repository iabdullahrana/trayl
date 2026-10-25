import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  runInNewContext(code, {
    exports,
    ...globals,
    require(name) {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return exports;
}
function actions({
  access = true,
  row = null,
  readError = null,
  rpcError = null,
  claim = true,
  traveller = false,
} = {}) {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: claim, error: rpcError };
    },
    from: (table) => {
      assert.equal(table, "handovers");
      return {
        select: () => ({
          eq: (column, id) => {
            calls.push([column, id]);
            return {
              maybeSingle: async () => ({ data: row, error: readError }),
            };
          },
        }),
      };
    },
  };
  return {
    calls,
    ...load("app/chat/handover-actions.ts", {
      "@/lib/chat/server": {
        getChatAccess: async () =>
          access
            ? {
                supabase: client,
                user: { id: traveller ? "b" : "a" },
                journey: {
                  traveller_id: "b",
                  from_city: "Jaipur",
                  to_city: "Gurgaon",
                  travel_date: "2099-01-01",
                },
              }
            : null,
      },
    }),
  };
}
test("handover actions reject nonparticipants without a mutation", async () => {
  const api = actions({ access: false });
  assert.ok((await api.confirmHandover("id")).error);
  assert.equal(api.calls.length, 0);
});
test("one-sided confirmation cannot unlock a completed delivery card", async () => {
  const api = actions({
    row: {
      sender_confirmed_at: "now",
      traveller_confirmed_at: null,
      completed_at: null,
    },
  });
  const result = await api.confirmHandover("request");
  assert.equal(result.handover.mine, true);
  assert.equal(result.handover.theirs, false);
  assert.equal(result.handover.completedAt, null);
  assert.equal(api.calls[0][0], "confirm_handover");
  assert.equal(api.calls[0][1].chat_id, "request");
  assert.equal(Object.keys(api.calls[0][1]).length, 1);
});
test("background status reads do not consume the first-handover celebration", async () => {
  const api = actions({
    row: {
      sender_confirmed_at: "now",
      traveller_confirmed_at: "now",
      completed_at: "now",
    },
    traveller: true,
  });
  assert.ok((await api.loadHandover("id")).handover.completedAt);
  assert.ok(!api.calls.some(([name]) => name === "claim_first_moment"));
  assert.equal((await api.claimHandoverMoment("id")).firstMoment, true);
});
test("completion and milestone errors surface without claiming success", async () => {
  assert.ok(
    (await actions({ rpcError: { message: "blocked" } }).confirmHandover("id"))
      .error,
  );
  assert.ok((await actions({ readError: {} }).loadHandover("id")).error);
  const api = actions();
  assert.equal((await api.claimHandoverMoment("id")).firstMoment, false);
  assert.ok(!api.calls.some(([name]) => name === "claim_first_moment"));
});
test("relative time advances across minute/hour/day boundaries and clamps clock skew", () => {
  const { relativeTime } = load("lib/relative-time.ts");
  const time = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(relativeTime("2026-01-01T00:00:00Z", time - 1000), "just now");
  assert.equal(
    relativeTime("2026-01-01T00:00:00Z", time + 120000),
    "2 min ago",
  );
  assert.equal(
    relativeTime("2026-01-01T00:00:00Z", time + 3600000),
    "1 hr ago",
  );
  assert.equal(
    relativeTime("2026-01-01T00:00:00Z", time + 86400000),
    "1 day ago",
  );
  assert.equal(relativeTime("bad", time), "Time unavailable");
});
test("canvas export requires two-person completion and excludes personal data", async () => {
  const drawn = [];
  let downloaded = false,
    revoked = false;
  const context = {
    fillRect() {},
    strokeRect() {},
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    measureText(s) {
      return { width: s.length * 26 };
    },
    fillText(s) {
      drawn.push(s);
    },
  };
  const api = load(
    "lib/chat/share-card.ts",
    {},
    {
      document: {
        fonts: { ready: Promise.resolve() },
        body: { appendChild() {} },
        createElement(tag) {
          return tag === "canvas"
            ? { getContext: () => context, toBlob: (fn) => fn({}) }
            : {
                click() {
                  downloaded = true;
                },
                remove() {},
              };
        },
      },
      getComputedStyle: () => ({ getPropertyValue: () => "#123524" }),
      URL: {
        createObjectURL: () => "blob:test",
        revokeObjectURL() {
          revoked = true;
        },
      },
      setTimeout(fn) {
        fn();
      },
    },
  );
  await assert.rejects(api.downloadDeliveryCard({ completedAt: null }));
  assert.equal(downloaded, false);
  await api.downloadDeliveryCard({
    completedAt: "now",
    from: "Jaipur",
    to: "Gurgaon",
    date: "2099-01-01",
    email: "private@example.com",
    phone: "secret",
  });
  assert.ok(downloaded && revoked);
  assert.ok(drawn.includes("JAIPUR"));
  assert.ok(drawn.includes("Delivered via Trayl"));
  assert.ok(!drawn.some((s) => s.includes("private") || s.includes("secret")));
});

test("first-post milestone failure never disguises a committed journey as failed", async () => {
  const values = {
    from_city: "A",
    to_city: "B",
    travel_date: "2099-01-01",
    travel_time: "12:00",
    item_type: "document",
  };
  for (const failure of [false, true]) {
    const api = load("app/post-journey/actions.ts", {
      "next/cache": { revalidatePath() {} },
      "@/lib/supabase/config": { getSupabaseConfig: () => true },
      "@/lib/journeys/validation": {
        validateJourney: () => ({ values, fieldErrors: {}, valid: true }),
      },
      "@/lib/supabase/server": {
        createClient: () => ({
          auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
          from: () => ({ insert: async () => ({ error: null }) }),
          rpc: async () =>
            failure
              ? { error: { message: "offline" } }
              : { data: true, error: null },
        }),
      },
    });
    const result = await api.postJourney({}, {});
    assert.equal(result.success, true);
    assert.equal(result.firstMoment, !failure);
    assert.equal(Boolean(result.notice), failure);
  }
});

test("animated counts settle in 400ms and cancel immediately for reduced motion or unmount", () => {
  let effect,
    changed,
    display,
    sequence = 0;
  const frames = new Map();
  const media = {
    matches: false,
    addEventListener(_name, fn) {
      changed = fn;
    },
    removeEventListener() {
      changed = null;
    },
  };
  const api = load(
    "components/ui/AnimatedCount.tsx",
    {
      react: {
        useEffect: (fn) => {
          effect = fn;
        },
        useRef: () => ({ current: 2 }),
        useState: () => [
          2,
          (n) => {
            display = n;
          },
        ],
      },
      "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    },
    {
      window: { matchMedia: () => media },
      performance: { now: () => 0 },
      requestAnimationFrame: (fn) => {
        frames.set(++sequence, fn);
        return sequence;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
    },
  );
  api.AnimatedCount({ value: 10 });
  let dispose = effect();
  const advance = (time) => {
    const [id, fn] = frames.entries().next().value;
    frames.delete(id);
    fn(time);
  };
  advance(200);
  assert.ok(display > 2 && display < 10);
  advance(400);
  assert.equal(display, 10);
  assert.equal(frames.size, 0);
  dispose();
  api.AnimatedCount({ value: 20 });
  dispose = effect();
  media.matches = true;
  changed();
  assert.equal(display, 20);
  assert.equal(frames.size, 0);
  dispose();
  assert.equal(changed, null);
  media.matches = false;
  api.AnimatedCount({ value: 5 });
  dispose = effect();
  dispose();
  assert.equal(frames.size, 0);
});
