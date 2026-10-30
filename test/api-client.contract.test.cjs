const assert = require("node:assert/strict");
const test = require("node:test");
const { createBitsnapClient } = require("../dist/client.js");
const { BitsnapApiError } = require("../dist/errors.js");
const pkg = require("../package.json");

function recorder(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: new Headers(init.headers),
      body: init.body === undefined ? undefined : JSON.parse(init.body),
      signal: init.signal,
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

test("createBitsnapClient requires an API key", () => {
  assert.throws(() => createBitsnapClient({ apiKey: "" }), /apiKey is required/);
});

test("reads POST the Connect JSON body with Bearer auth and no Idempotency-Key", async () => {
  const { calls, fetch } = recorder(() => json({ products: [], nextCursor: "" }));
  const client = createBitsnapClient({ apiKey: "bs_test_abc", fetch });
  const result = await client.products.list({ limit: 5, includeDrafts: true });

  assert.deepEqual(result, { products: [], nextCursor: "" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://bitsnap.pl/api/v1/bitsnap.v1.ProductsService/ListProducts");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { limit: 5, includeDrafts: true });
  assert.equal(calls[0].headers.get("authorization"), "Bearer bs_test_abc");
  assert.equal(calls[0].headers.get("content-type"), "application/json");
  assert.equal(calls[0].headers.get("x-bitsnap-client"), `bitsnap-js@${pkg.version}`);
  assert.equal(calls[0].headers.has("idempotency-key"), false);
});

test("an empty request sends {} and get(id) wraps the id", async () => {
  const { calls, fetch } = recorder(() => json({}));
  const client = createBitsnapClient({ apiKey: "bs_test_abc", host: "http://localhost:4321/", fetch });
  await client.account.get();
  await client.orders.get("ord_1");
  assert.equal(calls[0].url, "http://localhost:4321/api/v1/bitsnap.v1.AccountService/GetAccount");
  assert.deepEqual(calls[0].body, {});
  assert.equal(calls[1].url, "http://localhost:4321/api/v1/bitsnap.v1.OrdersService/GetOrder");
  assert.deepEqual(calls[1].body, { id: "ord_1" });
});

test("writes send a random Idempotency-Key per call, or the one you pass", async () => {
  const { calls, fetch } = recorder(() => json({ url: "https://pay.example/1", orderId: "o1", environment: "ENVIRONMENT_TEST" }));
  const client = createBitsnapClient({ apiKey: "bs_test_abc", fetch });
  const request = { items: [{ productId: "p1", quantity: 2 }], successUrl: "http://localhost:3000/ok" };

  await client.checkout.createCheckoutLink(request);
  await client.checkout.createCheckoutLink(request);
  await client.checkout.createCheckoutLink(request, { idempotencyKey: "order-42" });

  const [a, b, c] = calls.map((call) => call.headers.get("idempotency-key"));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
  assert.equal(c, "order-42");
  assert.equal(calls[0].url, "https://bitsnap.pl/api/v1/bitsnap.v1.CheckoutService/CreateCheckoutLink");
  assert.deepEqual(calls[0].body, request);
});

test("settleTestPayment, webhooks.create and the coupon writes are idempotent writes too", async () => {
  const { calls, fetch } = recorder(() => json({}));
  const client = createBitsnapClient({ apiKey: "bs_test_abc", fetch });
  await client.checkout.settleTestPayment({ orderId: "o1", outcome: "TEST_PAYMENT_OUTCOME_PAID" });
  await client.webhooks.create({ url: "https://example.com/hook" });
  await client.webhooks.delete({ id: "wh_1" });
  await client.coupons.create({ name: "Spring", discount: { percentOff: 10 } });
  await client.products.update({ id: "p1", revision: 3, name: "New" });

  assert.deepEqual(calls.map((call) => call.url.split("/").pop()), [
    "SettleTestPayment",
    "CreateWebhook",
    "DeleteWebhook",
    "CreateCoupon",
    "UpdateProduct",
  ]);
  for (const call of calls) assert.ok(call.headers.get("idempotency-key"), call.url);
  assert.deepEqual(calls[0].body, { orderId: "o1", outcome: "TEST_PAYMENT_OUTCOME_PAID" });
});

test("every RPC of the API has a method on the client", () => {
  const client = createBitsnapClient({ apiKey: "bs_test_abc", fetch: async () => json({}) });
  const methods = {
    account: ["get"],
    products: ["list", "get", "create", "update"],
    orders: ["list", "get"],
    coupons: ["list", "create", "update", "delete", "createCode", "updateCode", "deleteCode"],
    webhooks: ["list", "create", "delete"],
    checkout: ["createCheckoutLink", "settleTestPayment"],
    stats: ["getSalesSummary"],
  };
  for (const [service, names] of Object.entries(methods)) {
    for (const name of names) assert.equal(typeof client[service][name], "function", `${service}.${name}`);
  }
});

test("environment is read from the key prefix", () => {
  const make = (apiKey) => createBitsnapClient({ apiKey, fetch: async () => json({}) }).environment;
  assert.equal(make("bs_test_x"), "test");
  assert.equal(make("bs_live_x"), "live");
  assert.equal(make("api_legacy"), "live");
  assert.equal(make("bsat_token"), undefined);
});

test("errors become BitsnapApiError with status, code, reason, metadata and requestId", async () => {
  const body = {
    code: "permission_denied",
    message: "[missing_scope] The credential lacks products:write.",
    details: [{ type: "bitsnap.v1.ErrorInfo", debug: { reason: "missing_scope", metadata: { scope: "products:write" } } }],
  };
  const { fetch } = recorder(() => json(body, { status: 403, headers: { "Content-Type": "application/json", "X-Request-ID": "req-9" } }));
  const client = createBitsnapClient({ apiKey: "bs_test_abc", fetch });

  await assert.rejects(
    () => client.products.create({ name: "x", price: { amount: 1, currency: "PLN" } }),
    (error) => {
      assert.ok(error instanceof BitsnapApiError);
      assert.equal(error.status, 403);
      assert.equal(error.connectCode, "permission_denied");
      assert.equal(error.reason, "missing_scope");
      assert.deepEqual(error.metadata, { scope: "products:write" });
      assert.equal(error.requestId, "req-9");
      assert.equal(error.detail, "The credential lacks products:write.");
      assert.match(error.message, /403 \(missing_scope\)/);
      assert.deepEqual(error.body, body);
      return true;
    }
  );
});

test("the reason falls back to the [reason] message prefix; non-JSON bodies still throw typed", async () => {
  const prefixOnly = recorder(() => json({ code: "not_found", message: "[product_not_found] No such product." }, { status: 404 }));
  await assert.rejects(
    () => createBitsnapClient({ apiKey: "k", fetch: prefixOnly.fetch }).products.get("x"),
    (error) => error instanceof BitsnapApiError && error.reason === "product_not_found" && error.requestId === undefined
  );

  const html = recorder(() => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(
    () => createBitsnapClient({ apiKey: "k", fetch: html.fetch }).account.get(),
    (error) => error instanceof BitsnapApiError && error.status === 502 && error.reason === undefined && error.body === "<html>Bad gateway</html>"
  );
});

test("network failures propagate and the caller's signal aborts the request", async () => {
  const failing = createBitsnapClient({ apiKey: "k", fetch: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(() => failing.account.get(), /fetch failed/);

  const controller = new AbortController();
  const hanging = createBitsnapClient({
    apiKey: "k",
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))),
  });
  const pending = hanging.account.get(undefined, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /aborted/);
});
