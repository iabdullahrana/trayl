import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
async function renderHome(current, overview = { journeys: [], requests: [] }) {
  const dependencies = {
    "react/jsx-runtime": jsx,
    "@/lib/data/cities.json": {
      default: JSON.parse(
        readFileSync(
          new URL("../lib/data/cities.json", import.meta.url),
          "utf8",
        ),
      ),
    },
    "next/link": { default: (props) => React.createElement("a", props) },
    "@/lib/auth/user": {
      getCurrentUser: async () => current,
      requireUser: async () => current,
    },
    "@/lib/home/overview": { getHomeOverview: async () => overview },
    "@/components/request-controls": {
      RequestControls: () =>
        React.createElement("span", null, "Accept / Decline"),
    },
    "@/components/journey-search": { SearchForm: () => null },
    "@/lib/journeys/validation": { todayUTC: () => "2099-01-01" },
  };
  function load(path) {
    const { outputText } = ts.transpileModule(
      readFileSync(new URL(path, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    const exports = {};
    runInNewContext(outputText, {
      exports,
      require: (name) => {
        if (name === "react") return React;
        if (name in dependencies) return dependencies[name];
        if (name.startsWith("@/components/"))
          return load(`../${name.slice(2)}.tsx`);
        throw new Error(`Unexpected dependency: ${name}`);
      },
    });
    return exports;
  }
  const page = await load("../app/page.tsx").default();
  // React 18's static renderer cannot directly resolve async server children.
  const resolved =
    typeof page.type === "function" ? await page.type(page.props) : page;
  return renderToStaticMarkup(resolved);
}
test("guest header offers login and signup", async () => {
  const html = await renderHome({ user: null, profile: null });
  assert.ok(html.includes('href="/login"'));
  assert.ok(html.includes('href="/signup"'));
  assert.ok(!html.includes("Open dashboard for"));
});
test("authenticated header replaces guest links with profile initials", async () => {
  const html = await renderHome({
    user: { id: "user" },
    profile: { name: "Ali Khan" },
  });
  assert.ok(!html.includes('href="/login"'));
  assert.ok(!html.includes('href="/signup"'));
  assert.ok(!html.includes("Log in or create an account"));
  assert.ok(html.includes("Open dashboard for Ali Khan"));
  assert.ok(html.includes("rounded-full"));
  assert.ok(html.includes(">AK<"));
});

test("returning home greets the user and omits empty requests", async () => {
  const html = await renderHome({
    user: { id: "user" },
    profile: { name: "Ali" },
  });
  assert.match(html, /Hey Ali/);
  assert.ok(!html.includes("Requests needing a response"));
  assert.ok(html.includes('action="/search"'));
  assert.ok(html.includes('action="/post-journey"'));
  assert.ok(html.includes("You don’t have any journeys posted."));
});
test("returning home shows pending requests with inline decisions", async () => {
  const html = await renderHome(
    { user: { id: "user" }, profile: { name: "Ali" } },
    {
      journeys: [],
      requests: [
        {
          id: "r1",
          senderName: "Sam",
          journeys: { from_city: "Jaipur", to_city: "Gurgaon" },
        },
      ],
    },
  );
  assert.ok(html.includes("Requests needing a response"));
  assert.ok(html.includes("Accept / Decline"));
  assert.ok(html.includes("Sam"));
});
