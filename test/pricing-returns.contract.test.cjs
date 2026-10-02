const assert = require("node:assert/strict");
const test = require("node:test");
const { BitsnapModels } = require("../dist/models.js");
const { createReturnsClient } = require("../dist/returns.js");

test("pricing schema preserves the authoritative price contract", () => {
  const input = {
    regularPrice: 10000,
    effectivePrice: 8000,
    currency: "PLN",
    discount: {
      id: "discount-1",
      type: "PERCENTAGE",
      value: 2000,
      status: "ACTIVE",
      startsAt: 1_800_000_000,
      endsAt: 1_800_086_400,
    },
    referencePrice: {
      amount: 9000,
      windowDays: 30,
      asOf: 1_800_000_000,
      basis: "observed-history",
      historyAvailable: true,
    },
    priceVersion: "variant-1:10000:discount-1:true",
    nextPriceChangeAt: 1_800_086_400,
  };

  const parsed = BitsnapModels.ProductPricingSchema.parse(input);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), input);
});

test("returns clients keep custom hosts isolated and can be created during SSR", async () => {
  const urls = [];
  const makeFetch = async (input) => {
    urls.push(String(input));
    return new Response("request rejected", { status: 400 });
  };
  const first = createReturnsClient({ projectID: "project-a", host: "https://one.example", fetch: makeFetch });
  const second = createReturnsClient({ projectID: "project-b", host: "https://two.example", fetch: makeFetch });

  await Promise.all([
    assert.rejects(first.startSession("one@example.com")),
    assert.rejects(second.startSession("two@example.com")),
  ]);

  assert.deepEqual(urls.sort(), [
    "https://one.example/api/rpc/public.v1.ReturnsService/StartReturnSession",
    "https://two.example/api/rpc/public.v1.ReturnsService/StartReturnSession",
  ]);
});
