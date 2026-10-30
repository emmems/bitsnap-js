const assert = require("node:assert/strict");
const test = require("node:test");
const { BitsnapBackend } = require("../dist/backend.js");

// `API_KEY` is module-level state in dist/backend.js and there is no reset API,
// so every call to `setApiKey` affects the rest of this process. The "no API
// key" case therefore runs BEFORE the first `setApiKey`, and later tests may
// assume a key is configured. Do not reorder without checking that assumption.

// A product as `public-commerce/products` returns it.
function productItem(overrides = {}) {
  return {
    id: "prodv2_1",
    name: "T-shirt",
    price: 4900,
    currency: "PLN",
    image_url: "https://cdn.example/t-shirt.png",
    images: [],
    ...overrides,
  };
}

// A card of `public-commerce/product-list`.
function card(overrides = {}) {
  return {
    id: "prodv2_1",
    uniqueSlug: "t-shirt",
    name: "T-shirt",
    shortDescription: "Soft",
    image: { url: "https://cdn.example/t-shirt.png", thumbnailUrl: null },
    price: 4900,
    currency: "PLN",
    cartItemId: "prodv2_1",
    ...overrides,
  };
}

function apiProduct(overrides = {}) {
  return {
    id: "prodv2_1",
    name: "T-shirt",
    status: "PRODUCT_STATUS_PUBLISHED",
    price: { amount: 4900, currency: "PLN" },
    images: ["https://cdn.example/t-shirt.png"],
    variants: [],
    revision: 1,
    ...overrides,
  };
}

const json = (body) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function stubFetch(handlers) {
  const calls = [];
  const makeFetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body === undefined ? undefined : JSON.parse(init.body),
    });
    for (const [match, respond] of handlers) {
      if (url.includes(match)) return respond(calls[calls.length - 1], calls.length);
    }
    throw new Error("unexpected request " + url);
  };
  return { makeFetch, calls };
}

async function withFetch(handlers, run) {
  const { makeFetch, calls } = stubFetch(handlers);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = makeFetch;
    return await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const publicHandlers = (cards, items, totalCount = cards.length) => [
  ["/public-commerce/product-list", () => json({ items: cards, totalCount })],
  ["/public-commerce/products?", () => json({ success: true, result: items })],
];

test("getProducts defaults to published only: the public list, no includeDrafts, no Authorization", async () => {
  await withFetch(publicHandlers([card()], [productItem()]), async (calls) => {
    const result = await BitsnapBackend.getProducts("project-1", 10, 0);

    assert.equal(calls.length, 2, "one call for the list, one for the details");
    const list = new URL(calls[0].url);
    assert.equal(list.origin + list.pathname, "https://bitsnap.pl/api/integrations/project-1/public-commerce/product-list");
    assert.equal(list.searchParams.get("limit"), "10");
    assert.equal(list.searchParams.get("offset"), "0");
    assert.equal(calls[0].headers.get("authorization"), null);
    assert.ok(calls[0].headers.get("x-bitsnap-client"));
    const details = new URL(calls[1].url);
    assert.equal(details.pathname, "/api/integrations/project-1/public-commerce/products");
    assert.equal(details.searchParams.get("ids"), "prodv2_1");

    assert.equal(result.data.success, true);
    assert.equal(result.data.totalCount, 1);
    assert.equal(result.data.result[0].id, "prodv2_1");
    assert.equal(result.data.result[0].price, 4900);
  });
});

test("getProducts walks pages when the limit is above the storefront page size", async () => {
  const cards = Array.from({ length: 60 }, (_, i) => card({ id: `prodv2_${i}`, cartItemId: `prodv2_${i}` }));
  const handlers = [
    ["/public-commerce/product-list", (call) => {
      const url = new URL(call.url);
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      return json({ items: cards.slice(offset, offset + limit), totalCount: 60 });
    }],
    ["/public-commerce/products?", (call) => {
      const ids = new URL(call.url).searchParams.get("ids").split(",");
      return json({ success: true, result: ids.map((id) => productItem({ id })) });
    }],
  ];
  await withFetch(handlers, async (calls) => {
    const result = await BitsnapBackend.getProducts("project-1", 100, 0);
    assert.equal(result.data.result.length, 60);
    assert.equal(result.data.totalCount, 60);
    assert.equal(result.data.result[59].id, "prodv2_59");
    const limits = calls.filter((c) => c.url.includes("product-list")).map((c) => new URL(c.url).searchParams.get("limit"));
    assert.deepEqual(limits, ["48", "48"], "the second request asks for the next page; the server returns the remaining 12");
  });
});

test("getProducts matches a product stored under its _default variant id and falls back to the card", async () => {
  const cards = [card({ id: "prodv2_1", cartItemId: "prodv2_1_default" }), card({ id: "prodv2_2", cartItemId: "prodv2_2", name: "Mug", price: 2500 })];
  await withFetch(publicHandlers(cards, [productItem({ id: "prodv2_1_default", variants: [] })]), async () => {
    const result = await BitsnapBackend.getProducts("project-1", 10, 0);
    assert.equal(result.data.result[0].id, "prodv2_1_default");
    // No details for the second card: the slim card is mapped to an item.
    assert.deepEqual(result.data.result[1], {
      id: "prodv2_2",
      name: "Mug",
      description: "Soft",
      price: 2500,
      currency: "PLN",
      image_url: "https://cdn.example/t-shirt.png",
      images: ["https://cdn.example/t-shirt.png"],
      isPublished: true,
    });
  });
});

test("getProducts with includeDrafts but no API key throws before fetching", async () => {
  await withFetch([], async (calls) => {
    await assert.rejects(
      () => BitsnapBackend.getProducts("project-1", 10, 0, undefined, { includeDrafts: true }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /BitsnapBackend\.setApiKey/);
        return true;
      }
    );
    assert.equal(calls.length, 0, "fetch must not be called without an API key");
  });
});

test("getProducts with includeDrafts lists through the API with the Bearer key", async () => {
  BitsnapBackend.setApiKey("bs_test_key");
  const handlers = [["ProductsService/ListProducts", () => json({
    products: [apiProduct({ status: "PRODUCT_STATUS_DRAFT", variants: [{ id: "prodv2_1_v1", name: "L", price: { amount: 5100, currency: "PLN" } }] })],
    nextCursor: "",
  })]];
  await withFetch(handlers, async (calls) => {
    const result = await BitsnapBackend.getProducts("project-1", 10, 0, undefined, { includeDrafts: true });

    assert.equal(calls.length, 1, "expected exactly one fetch");
    assert.equal(calls[0].url, "https://bitsnap.pl/api/v1/bitsnap.v1.ProductsService/ListProducts");
    assert.deepEqual(calls[0].body, { includeDrafts: true, limit: 10 });
    assert.equal(calls[0].headers.get("authorization"), "Bearer bs_test_key");
    assert.equal(calls[0].headers.has("idempotency-key"), false);

    const item = result.data.result[0];
    assert.equal(item.isPublished, false, "drafts stay distinguishable");
    assert.equal(item.price, 4900);
    assert.equal(item.currency, "PLN");
    assert.equal(item.variants[0].price, 5100);
    assert.equal(result.data.totalCount, 1);
  });
});

test("getProducts with includeDrafts honours offset by walking cursors; totalCount is a lower bound while pages remain", async () => {
  BitsnapBackend.setApiKey("bs_test_key");
  const handlers = [["ProductsService/ListProducts", (call) => {
    const page = call.body.cursor === undefined ? 0 : 1;
    const products = Array.from({ length: 100 }, (_, i) => apiProduct({ id: `p${page * 100 + i}` }));
    return json({ products, nextCursor: page === 0 ? "c1" : "c2" });
  }]];
  await withFetch(handlers, async (calls) => {
    const result = await BitsnapBackend.getProducts("project-1", 20, 90, undefined, { includeDrafts: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.cursor, "c1");
    assert.deepEqual(result.data.result.map((p) => p.id).slice(0, 2), ["p90", "p91"]);
    assert.equal(result.data.result.length, 20);
    assert.equal(result.data.totalCount, 111, "offset + limit + 1: there is another page");
  });
});

test("getProducts still supports groupVariants without asking for drafts", async () => {
  BitsnapBackend.setApiKey("bs_test_key");
  await withFetch(publicHandlers([card()], [productItem()]), async (calls) => {
    await BitsnapBackend.getProducts("project-1", 10, 0, undefined, { groupVariants: true });
    assert.equal(calls.length, 2);
    // an API key is configured at this point, yet groupVariants alone sends no auth
    for (const call of calls) assert.equal(call.headers.get("authorization"), null);
    assert.ok(!calls.some((c) => c.url.includes("/api/v1/")), "keyless reads never touch /api/v1");
  });
});

test("getProduct reads the public products endpoint and keeps the { data: { success, result } } shape", async () => {
  await withFetch([["/public-commerce/products?", () => json({ success: true, result: [productItem({ id: "prodv2_9" })] })]], async (calls) => {
    const result = await BitsnapBackend.getProduct("project-1", "prodv2_9");
    assert.equal(new URL(calls[0].url).searchParams.get("ids"), "prodv2_9");
    assert.equal(calls[0].headers.get("authorization"), null);
    assert.equal(result.data.success, true);
    assert.equal(result.data.result.id, "prodv2_9");
  });
  await withFetch([["/public-commerce/products?", () => json({ success: true, result: [] })]], async () => {
    const missing = await BitsnapBackend.getProduct("project-1", "nope");
    assert.equal(missing.data.success, false);
    assert.equal(missing.data.result, undefined);
  });
});
