const assert = require("node:assert/strict");
const test = require("node:test");
const { createBitsnapClient } = require("../dist/client.js");
const { BitsnapApiError } = require("../dist/errors.js");

function recorder(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: new Headers(init.headers),
      body: init.body === undefined ? undefined : JSON.parse(init.body),
    });
    return respond(calls.length - 1);
  };
  return { calls, fetch };
}

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const BASE = "https://bitsnap.pl/api/v1/bitsnap.v1.ChatService/";

// [method name on client.chat, RPC, is a write]
const RPCS = [
  ["createBuyerToken", "CreateBuyerToken", true],
  ["listChannels", "ListChannels", false],
  ["createChannel", "CreateChannel", true],
  ["updateChannel", "UpdateChannel", true],
  ["removeFromChannel", "RemoveFromChannel", true],
  ["getSettings", "GetSettings", false],
  ["updateSettings", "UpdateSettings", true],
  ["listBlocks", "ListBlocks", false],
  ["putBlock", "PutBlock", true],
  ["deleteBlock", "DeleteBlock", true],
  ["listReports", "ListReports", false],
  ["updateReport", "UpdateReport", true],
  ["listThreads", "ListThreads", false],
  ["listMessages", "ListMessages", false],
  ["replyToThread", "ReplyToThread", true],
];

test("every RPC of ChatService has a method that posts to its path; writes send an Idempotency-Key, reads do not", async () => {
  const { calls, fetch } = recorder(() => json({}));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  assert.equal(RPCS.length, 15);
  for (const [name] of RPCS) assert.equal(typeof client.chat[name], "function", name);

  for (const [name] of RPCS) await client.chat[name]({});
  assert.equal(calls.length, RPCS.length);
  RPCS.forEach(([name, rpc, isWrite], i) => {
    const call = calls[i];
    assert.equal(call.url, BASE + rpc, name);
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("authorization"), "Bearer bs_live_abc");
    assert.equal(call.headers.get("content-type"), "application/json");
    assert.equal(call.headers.has("idempotency-key"), isWrite, name);
  });
});

test("parameterless reads send {}", async () => {
  const { calls, fetch } = recorder(() => json({ threads: [] }));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  assert.deepEqual(await client.chat.listThreads(), { threads: [] });
  await client.chat.listChannels();
  await client.chat.getSettings();
  await client.chat.listBlocks();
  for (const call of calls) assert.deepEqual(call.body, {});
});

test("createBuyerToken sends camelCase email and ttlSeconds and returns the token", async () => {
  const response = { token: "bcht_abc.def", expiresAt: "2026-11-01T12:15:00Z" };
  const { calls, fetch } = recorder(() => json(response));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });

  assert.deepEqual(await client.chat.createBuyerToken({ email: "Anna@Example.com", ttlSeconds: 600 }), response);
  await client.chat.createBuyerToken({ email: "anna@example.com" }, { idempotencyKey: "tok-1" });

  assert.deepEqual(calls[0].body, { email: "Anna@Example.com", ttlSeconds: 600 });
  assert.deepEqual(calls[1].body, { email: "anna@example.com" });
  assert.equal(calls[1].headers.get("idempotency-key"), "tok-1");
});

test("request bodies keep their camelCase fields", async () => {
  const { calls, fetch } = recorder(() => json({}));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });

  await client.chat.listMessages({ threadId: "t1", before: "m9", limit: 20 });
  await client.chat.replyToThread({ threadId: "t1", body: "Hello", clientId: "6f1b2c3d-0000-4000-8000-000000000001" });
  await client.chat.createChannel({
    name: "VIP", whoCanPost: "members", productId: "prodv2_1", bannedWords: ["spam"],
    blockLinks: true, blockMedia: false, cooldownSeconds: 30,
  });
  await client.chat.updateChannel({ channelId: "c1", bannedWords: { words: [] }, productId: "" });
  await client.chat.removeFromChannel({ channelId: "c1", email: "a@x.pl" });
  await client.chat.updateSettings({ awayEnabled: true, awayNotice: "Back soon", notifyDefault: "email" });
  await client.chat.putBlock({ email: "a@x.pl" });
  await client.chat.deleteBlock({ email: "a@x.pl" });
  await client.chat.listReports({ status: "open", limit: 10 });
  await client.chat.updateReport({ reportId: "r1", status: "resolved" });

  assert.deepEqual(calls.map((call) => call.body), [
    { threadId: "t1", before: "m9", limit: 20 },
    { threadId: "t1", body: "Hello", clientId: "6f1b2c3d-0000-4000-8000-000000000001" },
    { name: "VIP", whoCanPost: "members", productId: "prodv2_1", bannedWords: ["spam"], blockLinks: true, blockMedia: false, cooldownSeconds: 30 },
    { channelId: "c1", bannedWords: { words: [] }, productId: "" },
    { channelId: "c1", email: "a@x.pl" },
    { awayEnabled: true, awayNotice: "Back soon", notifyDefault: "email" },
    { email: "a@x.pl" },
    { email: "a@x.pl" },
    { status: "open", limit: 10 },
    { reportId: "r1", status: "resolved" },
  ]);
});

test("replyToThread returns the pending message and the pack state", async () => {
  const response = {
    message: { id: "m1", threadId: "t1", authorEmail: "me@shop.pl", body: "Hello", status: "pending" },
    repliesLeft: 2,
    composerLocked: false,
  };
  const { fetch } = recorder(() => json(response));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  const result = await client.chat.replyToThread({ threadId: "t1", body: "Hello" });
  assert.equal(result.message.status, "pending");
  assert.equal(result.repliesLeft, 2);
});

// Connect error bodies as the API sends them: reason in details[].debug and as a message prefix.
function failure(connectCode, status, reason, metadata, headers = {}) {
  return () =>
    json(
      {
        code: connectCode,
        message: `[${reason}] Something happened.`,
        details: [{ type: "bitsnap.v1.ErrorInfo", debug: { reason, ...(metadata ? { metadata } : {}) } }],
      },
      { status, headers: { "Content-Type": "application/json", "X-Request-ID": "req-chat", ...headers } },
    );
}

const REASONS = [
  ["failed_precondition", 400, "chat_pack_empty"],
  ["permission_denied", 403, "chat_blocked"],
  ["permission_denied", 403, "chat_plan_required"],
  ["permission_denied", 403, "chat_denied"],
  ["permission_denied", 403, "live_mode_only"],
  ["not_found", 404, "chat_not_found"],
  ["not_found", 404, "chat_no_entitlement"],
  ["already_exists", 409, "chat_channel_exists"],
  ["unavailable", 503, "chat_unavailable"],
  ["unavailable", 503, "chat_token_not_configured"],
  ["unimplemented", 501, "method_not_found"],
];

for (const [connectCode, status, reason] of REASONS) {
  test(`chat error ${reason} maps to BitsnapApiError`, async () => {
    const { fetch } = recorder(failure(connectCode, status, reason));
    const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
    await assert.rejects(
      () => client.chat.replyToThread({ threadId: "t1", body: "x" }),
      (error) => {
        assert.ok(error instanceof BitsnapApiError);
        assert.equal(error.status, status);
        assert.equal(error.connectCode, connectCode);
        assert.equal(error.reason, reason);
        assert.equal(error.code, reason.toUpperCase());
        assert.equal(error.requestId, "req-chat");
        assert.equal(error.rule, undefined);
        assert.equal(error.retryAfter, undefined);
        return true;
      },
    );
  });
}

for (const rule of ["banned_word", "link", "media"]) {
  test(`chat_moderation exposes metadata.rule = ${rule}`, async () => {
    const { fetch } = recorder(failure("invalid_argument", 400, "chat_moderation", { rule }));
    const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
    await assert.rejects(
      () => client.chat.replyToThread({ threadId: "c1", body: "x" }),
      (error) => error.reason === "chat_moderation" && error.rule === rule && error.metadata.rule === rule,
    );
  });
}

test("chat_cooldown exposes retryAfter from the Retry-After header", async () => {
  const { fetch } = recorder(failure("resource_exhausted", 429, "chat_cooldown", { retry_after: "17" }, { "Retry-After": "17" }));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  await assert.rejects(
    () => client.chat.replyToThread({ threadId: "c1", body: "x" }),
    (error) => {
      assert.equal(error.reason, "chat_cooldown");
      assert.equal(error.connectCode, "resource_exhausted");
      assert.equal(error.retryAfter, 17);
      assert.equal(error.metadata.retry_after, "17");
      return true;
    },
  );
});

test("retryAfter falls back to metadata.retry_after, and the header wins when both are present", async () => {
  const metadataOnly = recorder(failure("resource_exhausted", 429, "chat_cooldown", { retry_after: "9" }));
  await assert.rejects(
    () => createBitsnapClient({ apiKey: "k", fetch: metadataOnly.fetch }).chat.replyToThread({ threadId: "c1", body: "x" }),
    (error) => error.retryAfter === 9,
  );

  const both = recorder(failure("resource_exhausted", 429, "chat_cooldown", { retry_after: "9" }, { "Retry-After": "30" }));
  await assert.rejects(
    () => createBitsnapClient({ apiKey: "k", fetch: both.fetch }).chat.replyToThread({ threadId: "c1", body: "x" }),
    (error) => error.retryAfter === 30,
  );

  // A Retry-After date (not seconds) is ignored rather than misread.
  const date = recorder(failure("resource_exhausted", 429, "rate_limited", undefined, { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" }));
  await assert.rejects(
    () => createBitsnapClient({ apiKey: "k", fetch: date.fetch }).chat.listThreads(),
    (error) => error.reason === "rate_limited" && error.retryAfter === undefined,
  );
});

test("errors thrown by the older constructor signature still work", () => {
  const error = new BitsnapApiError(500, "boom", "INTERNAL");
  assert.equal(error.status, 500);
  assert.equal(error.code, "INTERNAL");
  assert.equal(error.retryAfter, undefined);
  assert.equal(error.rule, undefined);
});
