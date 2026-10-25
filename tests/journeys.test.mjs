import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
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
    URLSearchParams,
    require: (name) => {
      if (!(name in dependencies))
        throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const validation = load("lib/journeys/validation.ts");
const search = load("lib/journeys/search.ts");
const journeyStatus = load("lib/journeys/status.ts");

test("journey history uses the full UTC departure time, including same-day departures", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  for (const [time, past] of [
    ["11:59:00", true],
    ["12:00:00", true],
    ["12:01:00", false],
  ]) {
    assert.equal(
      journeyStatus.isPastJourney(
        { travel_date: "2026-09-27", travel_time: time },
        now,
      ),
      past,
    );
  }
  assert.equal(
    journeyStatus.isPastJourney(
      { travel_date: "2026-09-26", travel_time: "23:59:00" },
      now,
    ),
    true,
  );
  assert.equal(
    journeyStatus.isPastJourney(
      { travel_date: "2026-09-28", travel_time: "00:00:00" },
      now,
    ),
    false,
  );
});

test("search defaults the date, normalizes cities and supports URL round-trips", () => {
  const { filters, error } = search.parseSearch(
    new URLSearchParams("from=New++York&to=Lahore"),
    "2026-09-27",
  );
  assert.equal(error, undefined);
  assert.equal(filters.from, "New York");
  assert.equal(filters.date, "2026-09-27");
  assert.equal(
    new URLSearchParams(search.searchKey(filters)).get("from"),
    "New York",
  );
});

test("search rejects malformed dates and overly long city filters", () => {
  for (const query of [
    "date=2026-02-30",
    "date=garbage",
    `from=${"x".repeat(101)}`,
  ]) {
    assert.ok(
      search.parseSearch(new URLSearchParams(query), "2026-09-27").error,
    );
  }
});

test("server search forwards validated filters to the restricted RPC", async () => {
  const calls = [];
  const api = load("lib/journeys/search-server.ts", {
    "server-only": {},
    "@/lib/supabase/config": { getSupabaseConfig: () => true },
    "@/lib/supabase/server": {
      createClient: () => ({
        rpc: (name, args) => {
          calls.push({ name, args });
          const chain = {
            order: () => chain,
            range: (from, to) => {
              calls.push({ from, to });
              return Promise.resolve({
                data: [{ id: "journey" }],
                error: null,
              });
            },
          };
          return chain;
        },
      }),
    },
  });
  const result = await api.searchJourneys({
    from: "Karachi",
    to: "Lahore",
    date: "2026-09-27",
  });
  assert.equal(result.journeys[0].id, "journey");
  assert.equal(calls[0].name, "search_journeys");
  assert.deepEqual(calls[1], { from: 0, to: 20 });
  assert.equal(calls[0].args.search_date, "2026-09-27");
});

test("search failures never masquerade as empty results", async () => {
  for (const configured of [true, false]) {
    const api = load("lib/journeys/search-server.ts", {
      "server-only": {},
      "@/lib/supabase/config": { getSupabaseConfig: () => configured },
      "@/lib/supabase/server": {
        createClient: () => ({
          rpc: async () => ({
            data: null,
            error: { message: "private details" },
          }),
        }),
      },
    });
    const result = await api.searchJourneys({
      from: "",
      to: "",
      date: "2026-09-27",
    });
    assert.ok(result.error);
    assert.equal(result.journeys.length, 0);
    assert.ok(!result.error.includes("private details"));
  }
});
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    from_city: " Karachi ",
    to_city: "Lahore",
    travel_date: "2099-10-10",
    travel_time: "09:30",
    item_type: "document",
    ...overrides,
  }))
    data.set(key, value);
  return data;
}

test("today and future dates are accepted; yesterday is rejected", () => {
  for (const [date, valid] of [
    ["2026-09-26", false],
    ["2026-09-27", true],
    ["2026-09-28", true],
  ]) {
    assert.equal(
      validation.validateJourney(form({ travel_date: date }), "2026-09-27")
        .valid,
      valid,
    );
  }
});
test("invalid dates, times, item types and empty cities are rejected", () => {
  for (const overrides of [
    { travel_date: "2027-02-29" },
    { travel_date: "2026-02-30" },
    { travel_date: "no-date" },
    { travel_time: "24:00" },
    { travel_time: "09:99" },
    { item_type: "large-package" },
    { from_city: " " },
  ]) {
    assert.equal(validation.validateJourney(form(overrides)).valid, false);
  }
  assert.equal(
    validation.validateJourney(
      form({
        travel_date: "2028-02-29",
        travel_time: "00:00",
        item_type: "package",
      }),
      "2028-02-28",
    ).valid,
    true,
  );
});
test("city comparison ignores case and redundant whitespace", () => {
  assert.ok(
    validation.validateJourney(
      form({ from_city: " New  York ", to_city: "new york" }),
    ).fieldErrors.to_city,
  );
  assert.equal(validation.validateJourney(form()).values.from_city, "Karachi");
});

function action({
  user = { id: "verified-user" },
  authError = null,
  insertError = null,
  configured = true,
  throws = false,
} = {}) {
  const inserts = [];
  const refreshes = [];
  const api = load("app/post-journey/actions.ts", {
    "@/lib/journeys/validation": validation,
    "@/lib/supabase/config": { getSupabaseConfig: () => configured },
    "@/lib/supabase/server": {
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user }, error: authError }) },
        from: (table) => {
          assert.equal(table, "journeys");
          return {
            insert: async (row) => {
              inserts.push(row);
              if (throws) throw Error("network failed");
              return { error: insertError };
            },
          };
        },
      }),
    },
    "next/cache": { revalidatePath: (path) => refreshes.push(path) },
  });
  return { ...api, inserts, refreshes };
}
test("insert uses verified user and active status, ignoring forged fields", async () => {
  const api = action();
  assert.equal(
    (
      await api.postJourney(
        {},
        form({ traveller_id: "someone-else", status: "completed" }),
      )
    ).success,
    true,
  );
  assert.equal(api.inserts.length, 1);
  assert.equal(api.inserts[0].traveller_id, "verified-user");
  assert.equal(api.inserts[0].status, "active");
  assert.equal(api.inserts[0].from_city, "Karachi");
  assert.ok(api.refreshes.includes("/dashboard"));
});
test("unauthenticated and invalid submissions never insert", async () => {
  for (const settings of [
    { user: null },
    { authError: { message: "expired" } },
    { configured: false },
  ]) {
    const api = action(settings);
    assert.ok((await api.postJourney({}, form())).error);
    assert.equal(api.inserts.length, 0);
  }
  const api = action();
  assert.ok(
    (await api.postJourney({}, form({ to_city: "karachi" }))).fieldErrors,
  );
  assert.equal(api.inserts.length, 0);
});
test("RLS, missing profile, database and transport errors are user-facing", async () => {
  for (const [settings, message] of [
    [
      { insertError: { code: "42501", message: "private database detail" } },
      /permission/,
    ],
    [{ insertError: { code: "23503" } }, /profile is missing/],
    [{ insertError: { code: "unknown" } }, /couldn't save/],
    [{ throws: true }, /couldn't confirm/],
  ]) {
    const api = action(settings);
    const state = await api.postJourney({}, form());
    assert.match(state.error, message);
    assert.equal(state.success, undefined);
    assert.equal(api.refreshes.length, 0);
  }
});
