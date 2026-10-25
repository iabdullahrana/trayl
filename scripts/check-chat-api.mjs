// Run only with three regular test accounts and an accepted, future, unblocked A/B chat.
// Tokens come from environment variables, never files or command-line arguments.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
};
const url = need("NEXT_PUBLIC_SUPABASE_URL"),
  key = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const requestId = need("CHAT_TEST_REQUEST_ID"),
  mediaPath = need("CHAT_TEST_MEDIA_PATH");
assert.match(requestId, /^[0-9a-f-]{36}$/i);
assert.ok(
  mediaPath.startsWith(`${requestId}/`),
  "Media must belong to the test chat",
);
const client = (token) =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
const tokens = [
  "CHAT_TEST_A_TOKEN",
  "CHAT_TEST_B_TOKEN",
  "CHAT_TEST_C_TOKEN",
].map(need);
const [a, b, c] = tokens.map(client);
async function cleanup(path) {
  const claim = await a.rpc("prepare_chat_media_cleanup", {
    chat_id: requestId,
    object_path: path,
  });
  assert.ok(
    !claim.error && claim.data,
    "Could not authorize test upload cleanup",
  );
  const removed = await a.storage.from("chat-media").remove([path]);
  assert.ok(
    !removed.error,
    "Test upload cleanup failed; remove unused fixture through the Storage dashboard",
  );
}
try {
  const ids = [];
  for (const [index, sdk] of [a, b, c].entries()) {
    const auth = await sdk.auth.getUser(tokens[index]);
    assert.ok(!auth.error && auth.data.user, "Expired/invalid test token");
    ids.push(auth.data.user.id);
    const profile = await sdk
      .from("profiles")
      .select("role, is_active")
      .eq("id", auth.data.user.id)
      .single();
    assert.ok(
      !profile.error && profile.data?.role === "user" && profile.data.is_active,
      "Use active regular users, not admins",
    );
  }
  assert.equal(new Set(ids).size, 3, "A, B and C must be distinct users");
  const request = await a
    .from("requests")
    .select("sender_id, journeys!inner(traveller_id)")
    .eq("id", requestId)
    .single();
  assert.ok(!request.error && request.data, "A cannot access test request");
  const participants = [
    request.data.sender_id,
    request.data.journeys.traveller_id,
  ].sort();
  assert.deepEqual(
    participants,
    ids.slice(0, 2).sort(),
    "A and B must be the two participants",
  );
  for (const sdk of [a, b]) {
    const state = await sdk.rpc("chat_send_state", { chat_id: requestId });
    assert.equal(state.data, "available");
    const messages = await sdk
      .from("messages")
      .select("id")
      .eq("request_id", requestId)
      .limit(1);
    assert.ok(
      !messages.error && messages.data?.length,
      "Upload/send at least one fixture message first",
    );
    const signed = await sdk.storage
      .from("chat-media")
      .createSignedUrl(mediaPath, 60);
    assert.ok(
      !signed.error && signed.data?.signedUrl,
      "Participant cannot sign the fixture attachment",
    );
  }
  const messages = await c
    .from("messages")
    .select("id")
    .eq("request_id", requestId);
  assert.ok(
    !messages.error && messages.data?.length === 0,
    "FAIL: C read messages",
  );
  const listed = await c.storage.from("chat-media").list(requestId);
  assert.ok(
    !listed.error && listed.data?.length === 0,
    "FAIL: C listed storage objects",
  );
  const signed = await c.storage
    .from("chat-media")
    .createSignedUrl(mediaPath, 60);
  assert.ok(
    signed.error &&
      [400, 403, 404].includes(
        Number(signed.error.statusCode ?? signed.error.status),
      ) &&
      !signed.data?.signedUrl,
    "FAIL: C created a signed URL",
  );
  console.log(
    "PASS: participant read/sign and outsider message/list/sign isolation",
  );
  if (process.argv.includes("--uploads")) {
    const cases = [
      {
        name: "valid.pdf",
        type: "application/pdf",
        data: Buffer.from("%PDF-1.4\n%%EOF"),
        allowed: true,
      },
      {
        name: "bad.exe",
        type: "application/x-msdownload",
        data: Buffer.from("MZ"),
        allowed: false,
      },
      {
        name: "large.pdf",
        type: "application/pdf",
        data: Buffer.alloc(15 * 1024 * 1024 + 1),
        allowed: false,
      },
    ];
    for (const entry of cases) {
      const path = `${requestId}/${crypto.randomUUID()}-review-${entry.name}`;
      try {
        const result = await a.storage
          .from("chat-media")
          .upload(path, entry.data, { contentType: entry.type, upsert: false });
        if (result.error) {
          assert.ok(
            [400, 403, 413, 415, 422].includes(
              Number(result.error.statusCode ?? result.error.status),
            ),
            "Storage failed for a reason other than validation/access denial",
          );
        }
        assert.equal(
          !result.error,
          entry.allowed,
          `Unexpected Storage result for ${entry.name}`,
        );
      } finally {
        await cleanup(path);
      }
    }
    console.log(
      "PASS: Storage HTTP MIME/size limits, with allowed-upload control and cleanup",
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Chat API check failed",
  );
  process.exitCode = 1;
}
