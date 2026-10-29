const assert = require("node:assert/strict");
const test = require("node:test");
const { BitsnapBackend } = require("../dist/backend.js");

// `API_KEY` is module-level state in dist/backend.js and there is no reset API,
// so every call to `setApiKey` affects the rest of this process. The "no API
// key" case therefore runs BEFORE the first `setApiKey`, and later tests may
// assume a key is configured. Do not reorder without checking that assumption.

function productItem(overrides = {}) {
  return {
    id: "product-1",
    name: "T-shirt",
    price: 4900,
    currency: "PLN",
    image_url: "https://cdn.example/t-shirt.png",
    images: [],
    ...overrides,
  };
}

function batchPayload(items) {
  return JSON.stringify([
    {
      result: {
        data: {
          success: true,
          result: items,
          totalCount: items.length,
        },
      },
    },
  ]);
}

function stubFetch(items) {
  const calls = [];
  const makeFetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(batchPayload(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { makeFetch, calls };
}

function trpcInput(call) {
  return JSON.parse(new URL(call.url).searchParams.get("input"));
}

test("getProducts defaults to published only: no includeDrafts, no Authorization", async () => {
  const { makeFetch, calls } = stubFetch([productItem()]);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = makeFetch;
    const result = await BitsnapBackend.getProducts("project-1", 10, 0);

    assert.equal(calls.length, 1, "expected exactly one fetch");
    const input = trpcInput(calls[0]);
    assert.equal(Object.hasOwn(input["0"], "includeDrafts"), false);
    assert.equal(input["0"].projectID, "project-1");
    assert.equal(calls[0].headers.get("authorization"), null);
    // the pre-existing headers stay as they were
    assert.equal(calls[0].headers.get("content-type"), "application/json");
    assert.equal(calls[0].headers.get("priority"), "u=3, i");

    assert.equal(result.data.totalCount, 1);
    assert.equal(result.data.result[0].id, "product-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProducts with includeDrafts but no API key throws before fetching", async () => {
  const { makeFetch, calls } = stubFetch([productItem()]);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = makeFetch;
    await assert.rejects(
      () => BitsnapBackend.getProducts("project-1", 10, 0, undefined, { includeDrafts: true }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /BitsnapBackend\.setApiKey/);
        return true;
      }
    );

    assert.equal(calls.length, 0, "fetch must not be called without an API key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProducts with includeDrafts sends the flag and the Bearer key", async () => {
  BitsnapBackend.setApiKey("test-api-key");

  const { makeFetch, calls } = stubFetch([productItem({ isPublished: true })]);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = makeFetch;
    await BitsnapBackend.getProducts("project-1", 10, 0, undefined, { includeDrafts: true });

    assert.equal(calls.length, 1, "expected exactly one fetch");
    const input = trpcInput(calls[0]);
    assert.equal(input["0"].includeDrafts, true);
    assert.equal(calls[0].headers.get("authorization"), "Bearer test-api-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProducts still supports groupVariants without asking for drafts", async () => {
  const { makeFetch, calls } = stubFetch([productItem()]);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = makeFetch;
    await BitsnapBackend.getProducts("project-1", 10, 0, undefined, { groupVariants: true });

    assert.equal(calls.length, 1, "expected exactly one fetch");
    const input = trpcInput(calls[0]);
    assert.equal(input["0"].groupVariants, true);
    assert.equal(Object.hasOwn(input["0"], "includeDrafts"), false);
    // an API key is configured at this point, yet groupVariants alone sends no auth
    assert.equal(calls[0].headers.get("authorization"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProducts keeps isPublished so drafts are distinguishable", async () => {
  const { makeFetch, calls } = stubFetch([productItem({ isPublished: false })]);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = makeFetch;
    const result = await BitsnapBackend.getProducts("project-1", 10, 0, undefined, {
      includeDrafts: true,
    });

    assert.equal(calls.length, 1, "expected exactly one fetch");
    assert.equal(result.data.result[0].isPublished, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
