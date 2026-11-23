const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createBitsnapClient } = require("../dist/client.js");

function makeFakeFetch(responseBody = {}, status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: init.headers,
      body: JSON.parse(init.body),
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify(responseBody),
    };
  };
  return { fn, calls };
}

describe("bitsnap.loyalty public-v1 client", () => {
  it("calls GetProgram without Idempotency-Key", async () => {
    const { fn, calls } = makeFakeFetch({
      program: {
        pointsEnabled: true,
        clubsEnabled: true,
        pointsName: "Gwiazdki",
        pointsShortLabel: "gw",
        pointsIconType: "lucide",
        pointsIconValue: "Star",
      },
    });
    const client = createBitsnapClient({ apiKey: "bs_test_123", host: "https://example.test", fetch: fn });
    const res = await client.loyalty.getProgram();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.test/api/v1/bitsnap.v1.LoyaltyService/GetProgram");
    assert.equal(calls[0].headers["Idempotency-Key"], undefined);
    assert.equal(res.program.pointsName, "Gwiazdki");
    assert.equal(res.program.pointsIconValue, "Star");
  });

  it("calls ListClubs, ListPointTransactions and GetCustomer", async () => {
    const { fn, calls } = makeFakeFetch({ clubs: [], transactions: [], activeClubs: [] });
    const client = createBitsnapClient({ apiKey: "bs_live_123", host: "https://example.test", fetch: fn });
    await client.loyalty.listClubs({ includeArchived: true });
    await client.loyalty.listPointTransactions({ email: "jan@example.com", limit: 25 });
    await client.loyalty.getCustomer("jan@example.com");

    assert.equal(calls[0].url, "https://example.test/api/v1/bitsnap.v1.LoyaltyService/ListClubs");
    assert.deepEqual(calls[0].body, { includeArchived: true });
    assert.equal(calls[1].url, "https://example.test/api/v1/bitsnap.v1.LoyaltyService/ListPointTransactions");
    assert.deepEqual(calls[1].body, { email: "jan@example.com", limit: 25 });
    assert.equal(calls[2].url, "https://example.test/api/v1/bitsnap.v1.LoyaltyService/GetCustomerLoyalty");
    assert.deepEqual(calls[2].body, { email: "jan@example.com" });
  });

  it("calls AdjustPoints with Idempotency-Key", async () => {
    const { fn, calls } = makeFakeFetch({
      transaction: { id: "42", pointsDelta: 100 },
      balance: { availablePoints: 100, pendingPoints: 0, reservedPoints: 0, expiringSoonPoints: 0 },
    });
    const client = createBitsnapClient({ apiKey: "bs_live_123", host: "https://example.test", fetch: fn });
    const res = await client.loyalty.adjustPoints(
      { email: "jan@example.com", points: 100, note: "Bonus" },
      { idempotencyKey: "bonus-1" },
    );
    assert.equal(calls[0].url, "https://example.test/api/v1/bitsnap.v1.LoyaltyService/AdjustPoints");
    assert.equal(calls[0].headers["Idempotency-Key"], "bonus-1");
    assert.deepEqual(calls[0].body, { email: "jan@example.com", points: 100, note: "Bonus" });
    assert.equal(res.balance.availablePoints, 100);
  });
});
