import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const id = "11111111-1111-4111-8111-111111111111";
const journey = {
  id,
  traveller_id: "owner",
  from_city: "Karachi",
  to_city: "Lahore",
  travel_date: "2099-10-10",
  travel_time: "10:00:00",
  status: "active",
};
function harness(
  path,
  { user = { id: "sender" }, responses = [], contactError = null } = {},
) {
  const calls = [],
    refreshes = [],
    rpcCalls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const response = responses.shift();
      assert.ok(response, `Unexpected query to ${table}`);
      assert.equal(table, response.table);
      const call = { table, operations: [] };
      calls.push(call);
      const builder = {
        then: (resolve, reject) =>
          Promise.resolve({
            data: response.data ?? null,
            error: response.error ?? null,
          }).then(resolve, reject),
      };
      for (const method of [
        "select",
        "eq",
        "in",
        "order",
        "limit",
        "range",
        "maybeSingle",
        "insert",
        "update",
        "or",
      ])
        builder[method] = (...args) => {
          call.operations.push([method, ...args]);
          return builder;
        };
      return builder;
    },
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return {
        data: contactError
          ? null
          : [{ phone: "1234567", email: "test@example.com" }],
        error: contactError,
      };
    },
  };
  const dependencies = {
    "server-only": {},
    "@/lib/supabase/server": { createClient: () => supabase },
    "@/lib/supabase/config": { getSupabaseConfig: () => true },
    "next/navigation": {
      redirect: (url) => {
        throw Error(`redirect:${url}`);
      },
    },
    "next/cache": { revalidatePath: (url) => refreshes.push(url) },
  };
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
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return { ...exports, calls, refreshes, rpcCalls };
}
const actionPath = "app/dashboard/request-actions.ts";

function cancelForm(value = id) {
  const form = new FormData();
  form.set("journey_id", value);
  form.set("traveller_id", "someone-else");
  return form;
}

test("cancellation requires an authenticated user and a valid journey ID", async () => {
  const path = "app/dashboard/journey-actions.ts";
  await assert.rejects(
    harness(path, { user: null }).cancelJourney({}, cancelForm()),
    /redirect:\/login/,
  );
  const api = harness(path);
  assert.ok((await api.cancelJourney({}, cancelForm("not-a-uuid"))).error);
  assert.equal(api.calls.length, 0);
});

test("cancellation updates only the owner's active future journeys", async () => {
  const api = harness("app/dashboard/journey-actions.ts", {
    responses: [{ table: "journeys", data: [{ id }] }],
  });
  assert.equal(
    (await api.cancelJourney({}, cancelForm())).success,
    "Journey cancelled.",
  );
  const operations = api.calls[0].operations;
  assert.equal(
    operations.find(([method]) => method === "update")[1].status,
    "cancelled",
  );
  assert.ok(
    operations.some(
      ([method, column, value]) =>
        method === "eq" && column === "traveller_id" && value === "sender",
    ),
  );
  assert.ok(
    operations.some(
      ([method, column, value]) =>
        method === "eq" && column === "status" && value === "active",
    ),
  );
  assert.match(
    operations.find(([method]) => method === "or")[1],
    /^travel_date\.gt\.\d{4}-\d{2}-\d{2},and\(travel_date\.eq\.\d{4}-\d{2}-\d{2},travel_time\.gt\.\d{2}:\d{2}:\d{2}/,
  );
  assert.ok(api.refreshes.includes("/dashboard"));
  assert.ok(api.refreshes.includes("/search"));
});

test("stale, past or unauthorized cancellations don't report success", async () => {
  for (const response of [
    { table: "journeys", data: [] },
    { table: "journeys", error: { code: "42501" } },
  ]) {
    const api = harness("app/dashboard/journey-actions.ts", {
      responses: [response],
    });
    const state = await api.cancelJourney({}, cancelForm());
    assert.ok(state.error);
    assert.equal(state.success, undefined);
    assert.equal(api.refreshes.length, 0);
  }
});

test("sendRequest requires login", async () => {
  await assert.rejects(
    harness(actionPath, { user: null }).sendRequest(id),
    /redirect:\/login/,
  );
});
test("sendRequest records the authenticated sender and pending status", async () => {
  const api = harness(actionPath, {
    responses: [
      { table: "journeys", data: journey },
      { table: "requests", data: [] },
      { table: "requests" },
    ],
  });
  assert.equal((await api.sendRequest(id)).success, "Request sent.");
  const insert = api.calls[2].operations.find(([name]) => name === "insert")[1];
  assert.equal(insert.sender_id, "sender");
  assert.equal(insert.status, "pending");
  assert.ok(
    api.calls[1].operations.some(
      ([method, column, value]) =>
        method === "eq" && column === "status" && value === "pending",
    ),
  );
  assert.ok(api.refreshes.includes("/dashboard/requests-sent"));
});
test("duplicate pending requests are handled both before insert and after a race", async () => {
  for (const existing of [true, false]) {
    const api = harness(actionPath, {
      responses: [
        { table: "journeys", data: journey },
        { table: "requests", data: existing ? [{ id }] : [] },
        ...(!existing ? [{ table: "requests", error: { code: "23505" } }] : []),
      ],
    });
    assert.match(
      (await api.sendRequest(id)).success,
      /already have a pending request/,
    );
    assert.equal(api.calls.length, existing ? 2 : 3);
  }
});
test("own journeys and departed journeys cannot be requested", async () => {
  for (const data of [
    { ...journey, traveller_id: "sender" },
    { ...journey, travel_date: "2000-01-01" },
  ]) {
    const api = harness(actionPath, {
      responses: [{ table: "journeys", data }],
    });
    assert.ok((await api.sendRequest(id)).error);
    assert.equal(api.calls.length, 1);
  }
});
test("only the owner may respond; submitted status is allowlisted", async () => {
  const invalid = harness(actionPath);
  assert.ok((await invalid.updateRequestStatus(id, "pending")).error);
  assert.equal(invalid.calls.length, 0);
  const api = harness(actionPath, {
    responses: [
      { table: "requests", data: { journey_id: id } },
      { table: "journeys", data: journey },
    ],
  });
  assert.match(
    (await api.updateRequestStatus(id, "accepted")).error,
    /Only the traveller/,
  );
  assert.equal(api.calls.length, 2);
});
test("owner decisions target only pending rows and invalidate both views", async () => {
  for (const status of ["accepted", "declined"]) {
    const api = harness(actionPath, {
      user: { id: "owner" },
      responses: [
        { table: "requests", data: { journey_id: id } },
        { table: "journeys", data: journey },
        { table: "requests", data: [{ id }] },
      ],
    });
    assert.ok((await api.updateRequestStatus(id, status)).success);
    assert.equal(
      api.calls[2].operations.find(([name]) => name === "update")[1].status,
      status,
    );
    assert.ok(
      api.calls[2].operations.some(
        ([method, column, value]) =>
          method === "eq" && column === "status" && value === "pending",
      ),
    );
    assert.ok(api.refreshes.includes("/dashboard/requests-received"));
    assert.ok(api.refreshes.includes("/dashboard/requests-sent"));
  }
});
test("stale decisions show a refresh message", async () => {
  const api = harness(actionPath, {
    user: { id: "owner" },
    responses: [
      { table: "requests", data: { journey_id: id } },
      { table: "journeys", data: journey },
      { table: "requests", data: [] },
    ],
  });
  assert.match(
    (await api.updateRequestStatus(id, "accepted")).error,
    /already changed/,
  );
});

test("both request views reveal only accepted contacts through the RPC", async () => {
  for (const direction of ["received", "sent"]) {
    const requests = ["pending", "accepted", "declined"].map((status) => ({
      id: status,
      journey_id: id,
      sender_id: "sender",
      status,
    }));
    const journeyResponse = { table: "journeys", data: [journey] };
    const requestResponse = {
      table: "requests",
      data: requests.map((r) => ({ ...r, journey })),
    };
    const other = direction === "received" ? "sender" : "owner";
    const api = harness("lib/requests/dashboard.ts", {
      user: { id: direction === "received" ? "owner" : "sender" },
      responses: [
        requestResponse,
        {
          table: "profile_directory",
          data: [{ id: other, name: "Other person" }],
        },
      ],
    });
    const result = await api.getRequests(direction);
    assert.equal(result.length, 3);
    assert.ok(
      api.calls[0].operations.some(
        (op) => op[0] === "range" && op[1] === 0 && op[2] === 20,
      ),
    );
    assert.ok(
      api.calls[0].operations.some(
        (op) =>
          op[0] === "eq" &&
          op[1] ===
            (direction === "received" ? "journey.traveller_id" : "sender_id"),
      ),
    );
    assert.equal(result[0].contact, null);
    assert.equal(result[2].contact, null);
    assert.equal(result[1].contact.email, "test@example.com");
    assert.equal(api.rpcCalls.length, 1);
    assert.equal(api.rpcCalls[0].name, "contact_reveal");
    assert.equal(api.rpcCalls[0].args.other_user_id, other);
    assert.equal(api.rpcCalls[0].args.journey_id, id);
    assert.ok(api.calls.every((call) => call.table !== "profiles"));
  }
});
test("contact RPC failures never fall back to querying profile contacts", async () => {
  const api = harness("lib/requests/dashboard.ts", {
    contactError: { code: "denied" },
    responses: [
      {
        table: "requests",
        data: [
          {
            id,
            journey_id: id,
            sender_id: "sender",
            status: "accepted",
            journey,
          },
        ],
      },
      { table: "profile_directory", data: [{ id: "owner", name: "Owner" }] },
    ],
  });
  const [result] = await api.getRequests("sent");
  assert.equal(result.contact, null);
  assert.match(result.contactError, /unavailable/);
  assert.equal(api.rpcCalls.length, 1);
});
