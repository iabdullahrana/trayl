import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function setup(responses) {
  const calls = [];
  const client = {
    from(table) {
      const query = {};
      for (const method of [
        "select",
        "eq",
        "or",
        "order",
        "limit",
        "returns",
        "in",
      ]) {
        query[method] = (...args) => {
          calls.push([table, method, ...args]);
          return query;
        };
      }
      query.then = (yes, no) =>
        (responses[table] instanceof Error
          ? Promise.reject(responses[table])
          : Promise.resolve(responses[table] ?? { data: [], error: null })
        ).then(yes, no);
      return query;
    },
  };
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../lib/home/overview.ts", import.meta.url), "utf8"),
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
      if (name === "server-only") return {};
      assert.equal(name, "@/lib/supabase/server");
      return { createClient: () => client };
    },
  });
  return { ...exports, calls };
}
test("home queries are ownership-scoped, upcoming/pending, and database-limited to two", async () => {
  const api = setup({
    requests: {
      data: [
        {
          id: "request",
          sender_id: "sender",
          journeys: { from_city: "A", to_city: "B" },
        },
      ],
      error: null,
    },
    profile_directory: { data: [{ id: "sender", name: "Sam" }], error: null },
  });
  const result = await api.getHomeOverview(
    "owner",
    new Date("2026-10-02T12:34:56Z"),
  );
  assert.ok(
    api.calls.some(
      (call) =>
        call[0] === "journeys" &&
        call[1] === "eq" &&
        call[2] === "traveller_id" &&
        call[3] === "owner",
    ),
  );
  assert.ok(
    api.calls.some(
      (call) =>
        call[0] === "requests" &&
        call[1] === "eq" &&
        call[2] === "journeys.traveller_id" &&
        call[3] === "owner",
    ),
  );
  assert.ok(
    api.calls.some(
      (call) =>
        call[0] === "requests" &&
        call[1] === "eq" &&
        call[2] === "status" &&
        call[3] === "pending",
    ),
  );
  assert.equal(
    api.calls.filter((call) => call[1] === "limit" && call[2] === 2).length,
    2,
  );
  assert.ok(
    api.calls.some(
      (call) =>
        call[1] === "or" && call[2].includes("travel_time.gte.12:34:56"),
    ),
  );
  assert.equal(result.requests[0].senderName, "Sam");
  assert.ok(!api.calls.some((call) => call[0] === "profiles"));
});
test("home distinguishes partial query failures from empty successful lists", async () => {
  const api = setup({
    journeys: new Error("offline"),
    requests: { data: [], error: null },
  });
  const result = await api.getHomeOverview("owner");
  assert.ok(result.journeysError);
  assert.equal(result.requestsError, undefined);
  const names = setup({
    requests: {
      data: [{ id: "r", sender_id: "s", journeys: {} }],
      error: null,
    },
    profile_directory: { data: null, error: { message: "failed" } },
  });
  const failed = await names.getHomeOverview("owner");
  assert.ok(failed.requestsError);
  assert.equal(failed.requests.length, 0);
});
