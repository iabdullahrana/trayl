import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Run the actual TypeScript modules with only their external services replaced.
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
    require: (name) => dependencies[name] ?? require(name),
  });
  return exports;
}

const validation = load("lib/auth/validation.ts");
function form(overrides = {}) {
  const result = new FormData();
  const values = {
    name: "Test Traveller",
    email: "TEST@example.com",
    password: "valid-password-123",
    phone: "+92 300 1234567",
    is_adult_confirmed: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

function actions({
  signOutError = null,
  signupResult,
  loginResult,
  configured = true,
  fail = false,
  profile = { is_active: true },
  profileError = null,
} = {}) {
  const calls = [];
  const api = load("app/auth-actions.ts", {
    "@/lib/auth/validation": validation,
    "@/lib/supabase/config": { getSupabaseConfig: () => configured },
    "@/lib/supabase/server": {
      createClient: () => ({
        auth: {
          signUp: async (input) => {
            calls.push(input);
            if (fail) throw Error("offline");
            return signupResult;
          },
          signInWithPassword: async (input) => {
            calls.push(input);
            if (fail) throw Error("offline");
            return { data: { user: { id: "user" } }, ...loginResult };
          },
          signOut: async (options) => {
            calls.push("signOut");
            calls.push(options.scope);
            if (fail) throw Error("offline");
            return { error: signOutError };
          },
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: profile, error: profileError }),
            }),
          }),
        }),
      }),
    },
    "next/navigation": {
      redirect: (path) => {
        throw Error(`redirect:${path}`);
      },
    },
    "next/cache": {
      revalidatePath: (path) => calls.push(`revalidate:${path}`),
    },
  });
  return { ...api, calls };
}

test("unchecked adult confirmation is rejected before calling Supabase", async () => {
  const api = actions();
  const state = await api.signup({}, form({ is_adult_confirmed: "" }));
  assert.match(state.fieldErrors.is_adult_confirmed, /18/);
  assert.equal(api.calls.length, 0);
});

test("validates empty names, email, weak passwords and invalid phone", () => {
  const result = validation.validateAuth(
    form({ name: "  ", email: "invalid", password: "short", phone: "abc" }),
    "signup",
  );
  for (const field of ["name", "email", "password", "phone"])
    assert.ok(result.fieldErrors[field]);
  assert.equal(result.valid, false);
});

test("phone is optional and passwords are never trimmed", () => {
  const result = validation.validateAuth(
    form({ phone: "", password: " secret password " }),
    "signup",
  );
  assert.equal(result.valid, true);
  assert.equal(result.values.password, " secret password ");
});

test("signup sends profile metadata and handles confirmation without a session", async () => {
  const api = actions({
    signupResult: {
      data: { user: { id: "user", identities: [{}] }, session: null },
      error: null,
    },
  });
  const state = await api.signup({}, form());
  assert.match(state.success, /confirm your email/);
  assert.equal(api.calls[0].email, "test@example.com");
  assert.equal(api.calls[0].options.data.name, "Test Traveller");
  assert.equal(api.calls[0].options.data.is_adult_confirmed, true);
  assert.equal(api.calls[0].options.data.role, undefined);
});

test("signup with a session refreshes the layout and redirects home", async () => {
  const api = actions({
    signupResult: { data: { user: { id: "user" }, session: {} }, error: null },
  });
  await assert.rejects(api.signup({}, form()), /redirect:\//);
  assert.equal(api.calls.at(-1), "revalidate:/");
});

test("handles both explicit and obfuscated duplicate-account responses", async () => {
  for (const signupResult of [
    { data: {}, error: { code: "user_already_exists" } },
    { data: { user: { identities: [] }, session: null }, error: null },
  ]) {
    const state = await actions({ signupResult }).signup({}, form());
    assert.match(state.error, /already registered/);
  }
});

test("login maps credential and unconfirmed-email errors", async () => {
  for (const [code, message] of [
    ["invalid_credentials", /incorrect/],
    ["email_not_confirmed", /Confirm your email/],
  ]) {
    const state = await actions({ loginResult: { error: { code } } }).login(
      {},
      form(),
    );
    assert.match(state.error, message);
  }
});

test("password login refreshes layout and redirects without returning credentials", async () => {
  const api = actions({ loginResult: { error: null } });
  await assert.rejects(api.login({}, form()), /redirect:\//);
  assert.equal(api.calls[0].email, "test@example.com");
  assert.equal(api.calls.at(-1), "revalidate:/");
});

test("missing configuration and network failures produce usable errors", async () => {
  for (const name of ["login", "signup"]) {
    assert.match(
      (await actions({ configured: false })[name]({}, form())).error,
      /not configured/,
    );
    assert.match(
      (await actions({ fail: true })[name]({}, form())).error,
      /Unable to reach/,
    );
  }
});

const { NextRequest } = require("next/server");
function guard({
  configured = true,
  user = null,
  error = null,
  profile = { is_active: true, role: "user" },
  profileError = null,
  signOuts = [],
} = {}) {
  return load("middleware.ts", {
    "@/lib/supabase/config": {
      getSupabaseConfig: () =>
        configured ? { url: "url", anonKey: "key" } : null,
    },
    "@supabase/ssr": {
      createServerClient: (_url, _key, options) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll([
              {
                name: "test-session",
                value: "refreshed",
                options: { httpOnly: true, path: "/" },
              },
            ]);
            return { data: { user }, error };
          },
          signOut: async () => {
            signOuts.push(true);
            options.cookies.setAll([
              {
                name: "test-session",
                value: "",
                options: { path: "/", maxAge: 0 },
              },
            ]);
            return { error: null };
          },
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: profile, error: profileError }),
            }),
          }),
        }),
      }),
    },
  });
}

test("public routes remain accessible without a session or configuration", async () => {
  for (const configured of [true, false]) {
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/search",
      "/api/journeys/search",
    ]) {
      const response = await guard({ configured }).middleware(
        new NextRequest(`http://localhost${path}`),
      );
      assert.equal(response.status, 200);
    }
  }
});

test("protected routes fail closed and preserve refreshed cookies on redirect", async () => {
  const response = await guard().middleware(
    new NextRequest("http://localhost/dashboard?next=https://example.org"),
  );
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/login");
  assert.equal(response.cookies.get("test-session").value, "refreshed");
  const missingConfig = await guard({ configured: false }).middleware(
    new NextRequest("http://localhost/dashboard"),
  );
  assert.equal(missingConfig.status, 307);
});

test("authenticated users pass the guard; auth errors fail closed", async () => {
  for (const [error, status] of [
    [null, 200],
    [{ message: "invalid token" }, 307],
  ]) {
    const response = await guard({ user: { id: "user" }, error }).middleware(
      new NextRequest("http://localhost/dashboard"),
    );
    assert.equal(response.status, status);
  }
});

test("image-like protected routes are not exempted by the middleware matcher", () => {
  const matcher = new RegExp(`^${guard().config.matcher[0]}$`);
  assert.equal(matcher.test("/private/report.png"), true);
  assert.equal(matcher.test("/_next/static/chunk.js"), false);
});

test("deactivated or missing profiles cannot complete password login", async () => {
  for (const profile of [null, { is_active: false }]) {
    const api = actions({ loginResult: { error: null }, profile });
    const state = await api.login({}, form());
    assert.match(state.error, /deactivated/);
    assert.ok(api.calls.includes("signOut"));
    assert.ok(!api.calls.includes("revalidate:/"));
  }
});

test("deactivated sessions are cleared and denied protected routes", async () => {
  const signOuts = [];
  const response = await guard({
    user: { id: "user" },
    profile: { is_active: false, role: "user" },
    signOuts,
  }).middleware(new NextRequest("http://localhost/dashboard"));
  assert.equal(response.headers.get("location"), "http://localhost/login");
  assert.equal(response.cookies.get("test-session").value, "");
  assert.equal(signOuts.length, 1);
});

test("admin routes redirect all non-admins home, including guests", async () => {
  for (const settings of [
    { configured: false },
    { user: null },
    { user: { id: "u" } },
    { user: { id: "u" }, profile: { is_active: false, role: "admin" } },
    { user: { id: "u" }, profileError: { message: "unavailable" } },
  ]) {
    const response = await guard(settings).middleware(
      new NextRequest("http://localhost/admin"),
    );
    assert.equal(response.headers.get("location"), "http://localhost/");
  }
  const response = await guard({
    user: { id: "u" },
    profile: { is_active: true, role: "admin" },
  }).middleware(new NextRequest("http://localhost/admin"));
  assert.equal(response.status, 200);
});

test("logout ends the local session and invalidates authenticated layout cache", async () => {
  const api = actions();
  assert.equal((await api.logout()).success, true);
  assert.deepEqual(api.calls, ["signOut", "local", "revalidate:/"]);
});

test("logout errors remain retryable and do not report success", async () => {
  for (const options of [
    { signOutError: { message: "offline" } },
    { fail: true },
  ]) {
    const api = actions(options);
    const result = await api.logout();
    assert.ok(result.error);
    assert.equal(result.success, undefined);
    assert.ok(!api.calls.includes("revalidate:/"));
  }
});
