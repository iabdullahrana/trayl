import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    URLSearchParams,
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return exports;
}
const filters = load("lib/admin/filters.ts");
test("admin pagination and filters reject invalid inputs", () => {
  const parsed = filters.parseAdminFilters({
    users_page: "-1",
    journeys_page: "999999999999",
    requests_page: "2.5",
    users_status: "admin",
    journeys_status: "active",
    requests_status: ["pending", "accepted"],
  });
  assert.equal(parsed.users.page, 1);
  assert.equal(parsed.journeys.page, 1);
  assert.equal(parsed.requests.page, 1);
  assert.equal(parsed.users.status, "all");
  assert.equal(parsed.journeys.status, "active");
  assert.equal(parsed.requests.status, "all");
});
test("pagination links preserve other tables' filters and pages", () => {
  const parsed = filters.parseAdminFilters({
    users_page: "2",
    users_status: "inactive",
    requests_page: "3",
    requests_status: "pending",
  });
  const url = new URL(
    filters.adminQuery(parsed, "users", 3),
    "http://localhost",
  );
  assert.equal(url.searchParams.get("users_page"), "3");
  assert.equal(url.searchParams.get("users_status"), "inactive");
  assert.equal(url.searchParams.get("requests_page"), "3");
  assert.equal(url.searchParams.get("requests_status"), "pending");
  assert.equal(url.hash, "#users");
});

function access(profile, user = { id: "admin" }, configured = true) {
  return load("lib/admin/server.ts", {
    "server-only": {},
    "next/navigation": {
      redirect: (url) => {
        throw Error(`redirect:${url}`);
      },
    },
    "@/lib/supabase/config": { getSupabaseConfig: () => configured },
    "@/lib/supabase/server": {
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user }, error: null }) },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: profile, error: null }),
            }),
          }),
        }),
      }),
    },
  });
}
test("admin server guard requires an active admin profile", async () => {
  for (const profile of [
    null,
    { role: "user", is_active: true },
    { role: "admin", is_active: false },
  ])
    await assert.rejects(access(profile).requireAdmin(), /redirect:\//);
  await assert.rejects(
    access({ role: "admin", is_active: true }, null).requireAdmin(),
    /redirect:\//,
  );
  assert.equal(
    (await access({ role: "admin", is_active: true }).requireAdmin()).user.id,
    "admin",
  );
});

const target = "11111111-1111-4111-8111-111111111111";
function action({
  allowed = true,
  result = { data: true, error: null },
  userId = "admin",
} = {}) {
  const calls = [],
    refreshes = [];
  const api = load("app/admin/actions.ts", {
    "@/lib/admin/server": {
      requireAdmin: async () => {
        if (!allowed) throw Error("redirect:/");
        return {
          user: { id: userId },
          supabase: {
            rpc: async (name, args) => {
              calls.push({ name, args });
              return result;
            },
          },
        };
      },
    },
    "next/cache": { revalidatePath: (path) => refreshes.push(path) },
  });
  return { ...api, calls, refreshes };
}
function form(kind = "deactivate", id = target) {
  const data = new FormData();
  data.set("action", kind);
  data.set("id", id);
  return data;
}
test("admin actions check access before calling database RPCs", async () => {
  const api = action({ allowed: false });
  await assert.rejects(api.runAdminAction({}, form()), /redirect:\//);
  assert.equal(api.calls.length, 0);
});
test("admin actions only permit known operations and reject self-deactivation", async () => {
  for (const [settings, input] of [
    [{}, form("promote")],
    [{}, form("cancel", "bad-id")],
    [{ userId: target }, form()],
  ]) {
    const api = action(settings);
    assert.ok((await api.runAdminAction({}, input)).error);
    assert.equal(api.calls.length, 0);
  }
});
test("admin mutations use narrow RPCs and refresh application data", async () => {
  for (const kind of ["deactivate", "cancel"]) {
    const api = action();
    assert.ok((await api.runAdminAction({}, form(kind))).success);
    assert.equal(
      api.calls[0].name,
      kind === "deactivate"
        ? "admin_deactivate_user"
        : "admin_force_cancel_journey",
    );
    assert.ok(api.refreshes.includes("/"));
  }
});
test("admin stale-row and permission errors do not report success", async () => {
  for (const result of [
    { data: false, error: null },
    { data: null, error: { code: "42501" } },
  ]) {
    const api = action({ result });
    assert.ok((await api.runAdminAction({}, form())).error);
    assert.equal(api.refreshes.length, 0);
  }
});

test("admin date filters reject impossible and reversed dates and survive pagination", () => {
  const invalid = filters.parseAdminFilters({
    users_from: "2026-02-30",
    reports_from: "2026-10-05",
    reports_to: "2026-10-01",
  });
  assert.ok(invalid.users.error);
  assert.ok(invalid.reports.error);
  const valid = filters.parseAdminFilters({
    users_from: "2026-01-01",
    users_to: "2026-01-31",
    reports_from: "2026-09-01",
  });
  assert.equal(valid.users.error, undefined);
  const url = new URL(
    filters.adminQuery(valid, "users", 2),
    "http://localhost",
  );
  assert.equal(url.searchParams.get("users_from"), "2026-01-01");
  assert.equal(url.searchParams.get("users_to"), "2026-01-31");
  assert.equal(url.searchParams.get("reports_from"), "2026-09-01");
});
