const assert = require("node:assert/strict");
const test = require("node:test");
const { createReturnsClient } = require("../dist/returns.js");
const pkg = require("../package.json");

test("returns client sends X-Bitsnap-Client with the package version", async () => {
  const seen = [];
  const makeFetch = async (input, init) => {
    seen.push(new Headers(init?.headers).get("x-bitsnap-client"));
    return new Response("request rejected", { status: 400 });
  };
  const client = createReturnsClient({ projectID: "p", host: "https://one.example", fetch: makeFetch });
  await client.startSession("a@example.com").catch(() => {});
  assert.deepEqual(seen, [`bitsnap-js@${pkg.version}`]);
});
