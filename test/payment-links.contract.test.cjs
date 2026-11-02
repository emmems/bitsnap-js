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

const BASE = "https://bitsnap.pl/api/v1/bitsnap.v1.PaymentLinkService/";

const LINK = {
  id: "AbCd1234",
  name: "Konsultacja",
  price: { amount: 12300, currency: "PLN" },
  vatRate: 23,
  usage: "PAYMENT_LINK_USAGE_SINGLE",
  checkoutMode: "PAYMENT_LINK_CHECKOUT_MODE_NORMAL",
  status: "PAYMENT_LINK_STATUS_ACTIVE",
  url: "https://bitsnap.pl/l/AbCd1234",
  shortUrl: "https://bitsnap.pl/l/AbCd1234",
  paidCount: 0,
  hasPrefill: false,
  createdAt: "2027-01-15T08:00:00Z",
};

test("client.paymentLinks has the five methods, each posting to its RPC; writes send an Idempotency-Key, reads do not", async () => {
  const { calls, fetch } = recorder(() => json({}));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  for (const name of ["create", "get", "list", "archive", "send"]) {
    assert.equal(typeof client.paymentLinks[name], "function", name);
  }

  await client.paymentLinks.create({ name: "x", price: { amount: 100, currency: "PLN" } });
  await client.paymentLinks.get("AbCd1234");
  await client.paymentLinks.list();
  await client.paymentLinks.archive("AbCd1234");
  await client.paymentLinks.send({ id: "AbCd1234", email: "a@b.pl" });

  const expected = [
    ["CreatePaymentLink", true],
    ["GetPaymentLink", false],
    ["ListPaymentLinks", false],
    ["ArchivePaymentLink", true],
    ["SendPaymentLink", true],
  ];
  assert.equal(calls.length, expected.length);
  expected.forEach(([rpc, isWrite], i) => {
    const call = calls[i];
    assert.equal(call.url, BASE + rpc, rpc);
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("authorization"), "Bearer bs_live_abc");
    assert.equal(call.headers.has("idempotency-key"), isWrite, rpc);
  });
});

test("create sends the request as it is and returns the link", async () => {
  const { calls, fetch } = recorder(() => json({ paymentLink: LINK }));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  const request = {
    name: "Konsultacja",
    price: { amount: 12300, currency: "PLN" },
    usage: "PAYMENT_LINK_USAGE_REUSABLE",
    checkoutMode: "PAYMENT_LINK_CHECKOUT_MODE_QUICK",
    prefill: { email: "anna@example.com", nip: "5260250274" },
  };
  const { paymentLink } = await client.paymentLinks.create(request, { idempotencyKey: "invoice-77" });
  assert.deepEqual(calls[0].body, request);
  assert.equal(calls[0].headers.get("idempotency-key"), "invoice-77");
  assert.equal(paymentLink.url, "https://bitsnap.pl/l/AbCd1234");
});

test("get and archive send the id; list sends {} or the filter", async () => {
  const { calls, fetch } = recorder(() => json({ paymentLink: LINK, paymentLinks: [LINK], nextCursor: "" }));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  await client.paymentLinks.get("AbCd1234");
  await client.paymentLinks.archive("AbCd1234");
  await client.paymentLinks.list();
  await client.paymentLinks.list({ statuses: ["PAYMENT_LINK_STATUS_ARCHIVED"], limit: 10, cursor: "c1" });
  assert.deepEqual(calls[0].body, { id: "AbCd1234" });
  assert.deepEqual(calls[1].body, { id: "AbCd1234" });
  assert.deepEqual(calls[2].body, {});
  assert.deepEqual(calls[3].body, {
    statuses: ["PAYMENT_LINK_STATUS_ARCHIVED"],
    limit: 10,
    cursor: "c1",
  });
});

test("send passes the e-mail and the note and returns sentAt", async () => {
  const { calls, fetch } = recorder(() => json({ sentAt: "2027-01-15T08:00:00Z" }));
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  const res = await client.paymentLinks.send({ id: "AbCd1234", email: "a@b.pl", note: "Dzięki!" });
  assert.deepEqual(calls[0].body, { id: "AbCd1234", email: "a@b.pl", note: "Dzięki!" });
  assert.equal(res.sentAt, "2027-01-15T08:00:00Z");
});

function failure(status, code, reason, extra = {}, headers = {}) {
  return json(
    {
      code,
      message: `[${reason}] nope`,
      details: [{ type: "bitsnap.v1.ErrorInfo", debug: { reason, metadata: extra } }],
    },
    { status, headers: { "Content-Type": "application/json", ...headers } },
  );
}

test("errors surface their reason, field and Retry-After", async () => {
  const answers = [
    failure(400, "invalid_argument", "invalid_request", { field: "price.currency" }),
    failure(404, "not_found", "payment_link_not_found"),
    failure(400, "failed_precondition", "payment_link_paid"),
    failure(429, "resource_exhausted", "rate_limited", {}, { "Retry-After": "120" }),
    failure(403, "permission_denied", "live_mode_only"),
  ];
  const { fetch } = recorder((i) => answers[i]);
  const client = createBitsnapClient({ apiKey: "bs_live_abc", fetch });
  const next = (run) => run().then(
    () => assert.fail("expected an error"),
    (e) => e,
  );

  const field = await next(() =>
    client.paymentLinks.create({ name: "x", price: { amount: 100, currency: "XXX" } }),
  );
  assert.ok(field instanceof BitsnapApiError);
  assert.equal(field.reason, "invalid_request");
  assert.equal(field.metadata.field, "price.currency");

  assert.equal((await next(() => client.paymentLinks.get("Zzzzzzzz"))).reason, "payment_link_not_found");
  assert.equal(
    (await next(() => client.paymentLinks.send({ id: "AbCd1234", email: "a@b.pl" }))).reason,
    "payment_link_paid",
  );
  const limited = await next(() => client.paymentLinks.send({ id: "AbCd1234", email: "a@b.pl" }));
  assert.equal(limited.reason, "rate_limited");
  assert.equal(limited.retryAfter, 120);
  assert.equal((await next(() => client.paymentLinks.list())).reason, "live_mode_only");
});
