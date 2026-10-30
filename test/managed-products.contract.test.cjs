const assert = require("node:assert/strict");
const test = require("node:test");
const { BitsnapBackend, BitsnapApiError } = require("../dist/backend.js");
const errors = require("../dist/errors.js");

BitsnapBackend.setApiKey("bs_test_key");

function apiProduct(overrides = {}) {
  return {
    id: "prodv2_1",
    name: "Ebook",
    status: "PRODUCT_STATUS_DRAFT",
    price: { amount: 4900, currency: "PLN" },
    images: [],
    variants: [
      { id: "prodv2_1_a", name: "A", price: { amount: 4900, currency: "PLN" }, availableQuantity: 5 },
      { id: "prodv2_1_b", name: "B", price: { amount: 6900, currency: "PLN" } },
    ],
    revision: 4,
    ...overrides,
  };
}

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

async function withFetch(respond, run) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const call = {
        url: String(input),
        headers: new Headers(init.headers),
        body: JSON.parse(init.body),
      };
      calls.push(call);
      return respond(call, calls.length);
    };
    return await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const rpc = (call) => call.url.split("/").pop();

test("getManagedProduct maps the API product to the managed shape", async () => {
  await withFetch(() => json({ product: apiProduct({ availableQuantity: undefined }) }), async (calls) => {
    const product = await BitsnapBackend.getManagedProduct("project-1", "prodv2_1");
    assert.equal(calls[0].url, "https://bitsnap.pl/api/v1/bitsnap.v1.ProductsService/GetProduct");
    assert.deepEqual(calls[0].body, { id: "prodv2_1" });
    assert.equal(calls[0].headers.get("authorization"), "Bearer bs_test_key");
    assert.deepEqual(product, {
      id: "prodv2_1",
      name: "Ebook",
      status: "DRAFT",
      priceAmount: 4900,
      priceCurrency: "PLN",
      availableQuantity: null,
      images: [],
      variants: [
        { id: "prodv2_1_a", name: "A", priceAmount: 4900, priceCurrency: "PLN", availableQuantity: 5 },
        { id: "prodv2_1_b", name: "B", priceAmount: 6900, priceCurrency: "PLN", availableQuantity: null },
      ],
      revision: 4,
    });
  });
});

test("createProduct sends the Money body and an Idempotency-Key, and returns { id, revision }", async () => {
  await withFetch(() => json({ product: apiProduct({ id: "prodv2_7", revision: 1 }) }), async (calls) => {
    const result = await BitsnapBackend.createProduct("project-1", {
      name: "Ebook",
      priceAmount: 4900,
      priceCurrency: "PLN",
      status: "PUBLISHED",
      availableQuantity: 10,
      images: ["https://cdn.example/a.png"],
      variants: [{ name: "L", priceAmount: 5100 }],
    });
    assert.deepEqual(result, { id: "prodv2_7", revision: 1 });
    assert.equal(rpc(calls[0]), "CreateProduct");
    assert.deepEqual(calls[0].body, {
      name: "Ebook",
      price: { amount: 4900, currency: "PLN" },
      status: "PRODUCT_STATUS_PUBLISHED",
      availableQuantity: 10,
      images: ["https://cdn.example/a.png"],
      variants: [{ name: "L", price: { amount: 5100 } }],
    });
    assert.ok(calls[0].headers.get("idempotency-key"));
  });
});

test("updateProduct sends only the given fields; a lone priceAmount reads the currency first", async () => {
  await withFetch((call) => json({ product: apiProduct({ revision: 5 }) }), async (calls) => {
    const result = await BitsnapBackend.updateProduct("project-1", "prodv2_1", { name: "New", revision: 4 });
    assert.deepEqual(result, { id: "prodv2_1", revision: 5 });
    assert.deepEqual(calls[0].body, { id: "prodv2_1", revision: 4, name: "New" });

    await BitsnapBackend.updateProduct("project-1", "prodv2_1", { priceAmount: 5900 });
    assert.deepEqual(calls.slice(1).map(rpc), ["GetProduct", "UpdateProduct"]);
    assert.deepEqual(calls[2].body, { id: "prodv2_1", price: { amount: 5900, currency: "PLN" } });
  });
});

test("setStock and upsertVariant read, then write with the read revision", async () => {
  await withFetch((call) => json({ product: apiProduct({ revision: call.url.endsWith("UpdateProduct") ? 5 : 4 }) }), async (calls) => {
    await BitsnapBackend.setStock("project-1", "prodv2_1", 3, { variantID: "prodv2_1_b" });
    assert.deepEqual(calls.map(rpc), ["GetProduct", "UpdateProduct"]);
    assert.equal(calls[1].body.revision, 4);
    assert.deepEqual(calls[1].body.variants.map((v) => [v.id, v.availableQuantity]), [
      ["prodv2_1_a", 5],
      ["prodv2_1_b", 3],
    ]);

    await BitsnapBackend.deleteVariant("project-1", "prodv2_1", "prodv2_1_a");
    assert.deepEqual(calls[3].body.variants.map((v) => v.id), ["prodv2_1_b"]);
  });
});

test("API errors surface as BitsnapApiError with the reason (revision_conflict)", async () => {
  const body = {
    code: "aborted",
    message: "[revision_conflict] The product changed.",
    details: [{ type: "bitsnap.v1.ErrorInfo", debug: { reason: "revision_conflict" } }],
  };
  await withFetch(() => json(body, { status: 409, headers: { "Content-Type": "application/json", "X-Request-ID": "r-1" } }), async () => {
    await assert.rejects(
      () => BitsnapBackend.updateProduct("project-1", "prodv2_1", { name: "x", revision: 1 }),
      (error) => {
        // the class exported by backend and by errors are two bundled copies; instanceof works across them
        assert.ok(error instanceof BitsnapApiError);
        assert.ok(error instanceof errors.BitsnapApiError);
        assert.equal(error.status, 409);
        assert.equal(error.connectCode, "aborted");
        assert.equal(error.code, "REVISION_CONFLICT");
        assert.equal(error.reason, "revision_conflict");
        assert.equal(error.requestId, "r-1");
        return true;
      }
    );
  });
});
