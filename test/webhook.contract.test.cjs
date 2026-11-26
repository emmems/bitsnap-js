const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { handleWebhook, handleWebhookSignature, Event } = require("../dist/index.js");

const SECRET = "whsec_test_contract";
const URL_BASE = "https://shop.example/api/webhooks";

function sign(body) {
  return crypto.createHmac("sha512", SECRET).update(body).digest("hex");
}

// A TRANSACTION_SUCCESS webhook for an order paid with the built-in test gateway,
// in the protojson shape the Bitsnap server sends (IntegrationEventJob built in
// apps/bitsnap/server/event-system/event.handler.job.mapper.ts, then toJson):
// camelCase names, enums as names, int64 as strings, timestamps as RFC 3339.
function testModeSuccessPayload() {
  const customer = { email: "test@example.com", name: "Test Customer" };
  return {
    projectId: "prj_contract",
    environment: "TEST",
    eventData: {
      id: "test-order-1",
      eventId: "evt_test-order-1_TRANSACTION_SUCCESS",
      event: "TRANSACTION_SUCCESS",
      customer,
      order: {
        id: "test-order-1",
        status: "PAID",
        environment: "TEST",
        createdAt: "2026-11-26T10:00:00Z",
        customer,
        items: [
          { id: "test-product", quantity: 1, price: "1000", currency: "PLN", name: "Test product" },
        ],
        details: { gateway: "GATEWAY_BITSNAP_TEST", askForPhone: false },
        metadata: { source: "contract-test" },
        paymentGateway: "bitsnap_test",
        paymentId: "bst_123",
        paymentState: "PAYMENT_STATE_PAID",
        amountPaid: { amount: "1000", currency: "PLN" },
        amountRefunded: { amount: "0", currency: "PLN" },
      },
    },
  };
}

test("handleWebhook decodes a signed TEST-mode webhook paid with GATEWAY_BITSNAP_TEST", async () => {
  const body = JSON.stringify(testModeSuccessPayload());
  const result = await handleWebhook(body, URL_BASE, { "x-content-signature": sign(body) }, SECRET);

  assert.equal(result.isErr, false);
  assert.equal(result.projectId, "prj_contract");
  assert.equal(result.environment, 1); // Environment.TEST
  assert.equal(result.eventData.event, Event.TRANSACTION_SUCCESS);
  assert.equal(result.eventData.order.id, "test-order-1");
  assert.equal(result.eventData.order.details.gateway, 9); // Gateway.BITSNAP_TEST
  assert.equal(result.eventData.order.paymentGateway, "bitsnap_test");
  assert.equal(result.eventData.order.items[0].price, 1000n);
  assert.equal(result.eventData.order.amountPaid.amount, 1000n);
});

test("handleWebhook reads the signature from the sig query parameter", async () => {
  const body = JSON.stringify(testModeSuccessPayload());
  const result = await handleWebhook(body, `${URL_BASE}?sig=${sign(body)}`, {}, SECRET);

  assert.equal(result.isErr, false);
  assert.equal(result.eventData.order.details.gateway, 9);
});

test("handleWebhook tolerates enum values and fields no SDK version knows", async () => {
  const payload = testModeSuccessPayload();
  payload.eventData.order.details.gateway = "GATEWAY_SOMETHING_NEW";
  payload.eventData.order.paymentState = "PAYMENT_STATE_SOMETHING_NEW";
  payload.eventData.order.fieldFromTheFuture = { nested: true };
  payload.eventData.anotherNewField = "x";
  payload.fieldFromTheFuture = 1;
  const body = JSON.stringify(payload);

  const result = await handleWebhookSignature(body, sign(body), SECRET);

  assert.equal(result.isErr, false);
  assert.equal(result.eventData.event, Event.TRANSACTION_SUCCESS);
  assert.equal(result.eventData.order.id, "test-order-1");
  // Unknown enum values leave the field at its default instead of throwing.
  assert.equal(result.eventData.order.details.gateway, 0);
  assert.equal(result.eventData.order.paymentState, 0);
  assert.equal("fieldFromTheFuture" in result.eventData.order, false);
});

test("handleWebhook still rejects a bad signature before decoding", async () => {
  const body = JSON.stringify(testModeSuccessPayload());
  const result = await handleWebhook(body, URL_BASE, { "X-Content-Signature": "0".repeat(128) }, SECRET);

  assert.equal(result.isErr, true);
});
