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
const media = moduleAt("lib/chat/media.ts");
const types = moduleAt("lib/chat/types.ts");
const id = "11111111-1111-4111-8111-111111111111",
  requestId = "22222222-2222-4222-8222-222222222222";
const path = `${requestId}/${id}-photo.webp`;
const attachment = { path, name: "photo.webp", type: "image", size: 1200 };
const message = {
  id,
  request_id: requestId,
  sender_id: "sender",
  body: null,
  media_path: path,
  media_type: "image",
  media_name: "photo.webp",
  media_size: 1200,
};
function actions({
  responses = [],
  claim = true,
  removeError = null,
  access = true,
} = {}) {
  const calls = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "sender" } }, error: null }),
    },
    from(table) {
      const response = responses.shift();
      assert.ok(response, `Unexpected query ${table}`);
      const operations = [];
      calls.push({ table, operations });
      const chain = {
        then: (yes, no) => Promise.resolve(response).then(yes, no),
      };
      for (const op of ["select", "eq", "maybeSingle", "single", "insert"])
        chain[op] = (...args) => {
          operations.push([op, ...args]);
          return chain;
        };
      return chain;
    },
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      return { data: claim, error: null };
    },
    storage: {
      from(bucket) {
        return {
          remove: async (paths) => {
            calls.push({ bucket, removed: paths });
            return { error: removeError };
          },
        };
      },
    },
  };
  return {
    ...moduleAt("app/chat/media-actions.ts", {
      "@/lib/chat/media": media,
      "@/lib/chat/types": types,
      "@/lib/chat/safety": moduleAt("lib/chat/safety.ts"),
      "@/lib/chat/server": {
        getChatAccess: async () =>
          access ? { supabase: client, user: { id: "sender" } } : null,
      },
      "@/lib/supabase/server": { createClient: () => client },
    }),
    calls,
  };
}
test("media validation rejects unsupported/empty/oversize files before upload", () => {
  for (const type of Object.keys(media.MEDIA_TYPES))
    assert.equal(
      media.validateFile({ type, size: media.MAX_MEDIA_BYTES }),
      null,
    );
  for (const file of [
    { type: "image/svg+xml", size: 1 },
    { type: "toString", size: 1 },
    { type: "image/png", size: 0 },
    { type: "image/jpeg", size: media.MAX_MEDIA_BYTES + 1 },
  ])
    assert.ok(media.validateFile(file));
  assert.ok(media.validMedia(requestId, attachment));
  assert.ok(
    !media.validMedia(requestId, {
      ...attachment,
      path: "https://example.com/public.png",
    }),
  );
  assert.ok(
    !media.validMedia(requestId, {
      ...attachment,
      path: `${id}/${id}-photo.webp`,
    }),
  );
  assert.ok(
    !media.validMedia(requestId, {
      ...attachment,
      path: `${requestId}/${id}-../photo.webp`,
    }),
  );
  assert.match(
    media.sanitizeFilename("../my photo<script>.pdf"),
    /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/,
  );
});
test("image dimensions preserve aspect ratio and never upscale", () => {
  assert.equal(media.resizedDimensions(4000, 2000).width, 1600);
  assert.equal(media.resizedDimensions(4000, 2000).height, 800);
  assert.equal(media.resizedDimensions(600, 2400).width, 400);
  assert.equal(media.resizedDimensions(600, 2400).height, 1600);
  assert.equal(media.resizedDimensions(200, 100).width, 200);
});
test("media messages use the authenticated sender and support empty captions", async () => {
  const api = actions({ responses: [{ data: null }, { data: message }] });
  const result = await api.sendMediaMessage(requestId, id, "", attachment);
  assert.equal(result.message.id, id);
  const payload = api.calls[1].operations.find(([op]) => op === "insert")[1];
  assert.equal(payload.sender_id, "sender");
  assert.equal(payload.body, null);
  assert.equal(payload.media_path, path);
  assert.equal(payload.media_size, 1200);
});
test("failed inserts claim cleanup then remove their unused object", async () => {
  const api = actions({
    responses: [{ data: null }, { error: { code: "42501" } }, { data: null }],
  });
  const result = await api.sendMediaMessage(requestId, id, "", attachment);
  assert.equal(result.uploadRemoved, true);
  assert.ok(result.error);
  assert.equal(api.calls[3].rpc, "prepare_chat_media_cleanup");
  assert.equal(api.calls[4].removed[0], path);
});
test("lost responses never delete a committed attachment", async () => {
  const api = actions({
    responses: [
      { data: null },
      { error: { code: "network" } },
      { data: message },
    ],
  });
  const result = await api.sendMediaMessage(requestId, id, "", attachment);
  assert.equal(result.message.id, id);
  assert.ok(!api.calls.some((call) => call.removed));
});
test("cleanup races recheck confirmation and never delete without a claim", async () => {
  const api = actions({
    claim: false,
    responses: [{ data: null }, { data: message }],
  });
  const result = await api.cleanupMediaUpload(requestId, id, path);
  assert.equal(result.message.id, id);
  assert.ok(!api.calls.some((call) => call.removed));
});
test("offline cleanup is retained for retry rather than reported removed", async () => {
  const api = actions({
    responses: [{ data: null }],
    removeError: { message: "offline" },
  });
  const result = await api.cleanupMediaUpload(requestId, id, path);
  assert.equal(result.cleanupPending, true);
  assert.equal(result.uploadRemoved, undefined);
});
test("signed URLs batch only visible attachments and refresh before expiry", async () => {
  const { refreshSignedMedia } = moduleAt("lib/chat/signed-media.ts");
  const cache = new Map();
  const kinds = new Map(
    Array.from({ length: 54 }, (_, i) => [
      `path${i}`,
      i === 53 ? "document" : "image",
    ]),
  );
  const calls = [];
  const signer = {
    createSignedUrls: async (paths, seconds, options) => {
      calls.push({ paths, seconds, options });
      return {
        error: null,
        data: paths.map((path) => ({
          path,
          signedUrl: `https://private.example/sign/${path}`,
          error: null,
        })),
      };
    },
  };
  const visible = [...kinds.keys()].slice(0, 51).concat("path53");
  let now = 1000;
  await refreshSignedMedia(cache, kinds, visible, signer, () => now);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].paths.length, 50);
  assert.equal(calls[2].options.download, true);
  assert.ok(!cache.has("path52"));
  assert.ok(calls.every((call) => call.seconds === 3600));
  await refreshSignedMedia(cache, kinds, visible, signer, () => now);
  assert.equal(calls.length, 3);
  now += 3550_000;
  await refreshSignedMedia(cache, kinds, ["path0"], signer, () => now);
  assert.equal(calls.length, 4);
  assert.equal(calls[3].paths[0], "path0");
});
test("SDK upload transport forwards headers and reports real byte progress", async () => {
  let xhr;
  let fallback = false;
  class FakeXHR {
    constructor() {
      xhr = this;
      this.upload = {};
      this.headers = {};
      this.status = 200;
      this.statusText = "OK";
      this.responseText = '{"Key":"chat-media/file"}';
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(key, value) {
      this.headers[key] = value;
    }
    getAllResponseHeaders() {
      return "content-type: application/json";
    }
    send(body) {
      this.body = body;
      this.upload.onprogress({ lengthComputable: true, loaded: 3, total: 4 });
      this.onload();
    }
  }
  const { uploadFetch } = moduleAt(
    "lib/supabase/upload-client.ts",
    {},
    {
      URL,
      FormData,
      Blob,
      Headers,
      Response,
      DOMException,
      XMLHttpRequest: FakeXHR,
      fetch: async () => {
        fallback = true;
        return new Response("ok");
      },
    },
  );
  const progress = [];
  const form = new FormData();
  form.append("file", new Blob(["test"]));
  const response = await uploadFetch((value) => progress.push(value))(
    `https://project.supabase.co/storage/v1/object/chat-media/${path}`,
    {
      method: "POST",
      body: form,
      headers: { authorization: "Bearer test-token" },
    },
  );
  assert.equal(xhr.body, form);
  assert.equal(xhr.headers.authorization, "Bearer test-token");
  assert.equal(progress[0], 75);
  assert.equal(response.status, 200);
  await uploadFetch(() => {})("https://project.supabase.co/auth/v1/user", {
    method: "GET",
  });
  assert.equal(fallback, true);
});

test("canvas image preparation applies 1600px sizing and quality 0.8", async () => {
  let revoked = false;
  let quality;
  let drawn = false;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {
        drawn = true;
      },
    }),
    toBlob: (callback, type, q) => {
      quality = q;
      callback(new Blob(["compressed"], { type }));
    },
  };
  class FakeImage {
    naturalWidth = 4000;
    naturalHeight = 2000;
    async decode() {}
  }
  const { prepareMedia } = moduleAt(
    "lib/chat/prepare-media.ts",
    { "@/lib/chat/media": media },
    {
      Image: FakeImage,
      File,
      Blob,
      URL: {
        createObjectURL: () => "blob:preview",
        revokeObjectURL: () => {
          revoked = true;
        },
      },
      document: { createElement: () => canvas },
    },
  );
  const result = await prepareMedia(
    new File(["original"], "photo.gif", { type: "image/gif" }),
  );
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 800);
  assert.equal(quality, 0.8);
  assert.equal(drawn, true);
  assert.equal(result.type, "image/webp");
  assert.equal(result.name, "photo.webp");
  assert.equal(revoked, true);
});
test("filename truncation cannot introduce a leading period", () => {
  const filename = media.sanitizeFilename(
    "x".repeat(50) + "." + "a".repeat(99),
  );
  assert.ok(media.validMediaPath(requestId, `${requestId}/${id}-${filename}`));
});

test("rate-limited media removes its unused upload and explains the limit", async () => {
  const api = actions({
    responses: [
      { data: null },
      { error: { code: "P0001", message: "CHAT_RATE_LIMIT" } },
      { data: null },
    ],
  });
  const result = await api.sendMediaMessage(requestId, id, "", attachment);
  assert.equal(result.uploadRemoved, true);
  assert.match(result.error, /30 messages per minute/);
  assert.ok(api.calls.some((call) => call.removed));
});
