# Integrate bitsnap-js

`bitsnap-js` is the server SDK for public products, checkout links, notifications
and HMAC-SHA512 webhook verification. Use Node.js, including Next.js Node routes
or Astro with a Node adapter. Keep this package out of client components/islands.

## Install and configure

```sh
npm install bitsnap-js bitsnap-react
```

Use these application env names (the SDK does not load them):

- `BITSNAP_PROJECT_ID`: public project ID, not a numeric database ID.
- `BITSNAP_API_KEY`: secret project API key for authenticated operations, server
  test checkout and MCP. No `NEXT_PUBLIC_` or `PUBLIC_` prefix.
- `BITSNAP_WEBHOOK_SECRET`: separate secret from the webhook configuration.

Store secrets in ignored `.env.local` (Next.js), `.env` (Astro), or deployment
server variables. Never put them in props, browser requests, HTML or agent chat.
Public product reads and normal checkout need no API key.

## Fetch public products on the server

```ts
import { BitsnapBackend } from "bitsnap-js/backend";
import { BitsnapModels } from "bitsnap-js/models";

const projectID = process.env.BITSNAP_PROJECT_ID;
if (!projectID) throw new Error("Missing BITSNAP_PROJECT_ID");
const result = BitsnapModels.ProductsResultResultSchema.parse(
    await BitsnapBackend.getProducts(projectID, 20, 0),
  );
if (!result.data.success) throw new Error("Could not load products");
const products = result.data.result;
```

The schema parse works around broad response types in current declarations.
Use this in a Next.js server component or Astro frontmatter (`import.meta.env`
for Astro). `getProduct(projectID, id)` returns its product at `result?.data.result`.

## Verify the raw webhook before processing

```ts
import { handleWebhook } from "bitsnap-js";

export async function POST(request: Request) {
  const secret = process.env.BITSNAP_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 500 });
  const rawBody = await request.text();
  try {
    const result = await handleWebhook(
      rawBody, request.url, Object.fromEntries(request.headers), secret,
    );
    if (result.isErr) return new Response("Invalid signature", { status: 401 });
    // Validate result.projectId and environment. Persist/deduplicate eventData.id.
    // Add durable event processing before acknowledging production events.
    return new Response("OK");
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
}
```

Use `app/api/bitsnap/webhook/route.ts` with `runtime = "nodejs"` in Next.js.
Astro needs an `APIRoute` at `src/pages/api/bitsnap/webhook.ts`,
`export const prerender = false`, and an adapter. Check `output` and Node support.

## Avoid these mistakes

- Do not use `result.products`; the list is `result.data.result`.
- Use `Bitsnap.createCheckout(projectID, request)` from `bitsnap-js`. There is no
  standalone `createCheckout` export. Pass `apiKey` and `testMode: true` only on
  the server. Check `redirectURL`; the SDK does not check HTTP status.
- Do not call `request.json()` before verifying. Pass the raw text and full URL.
  The signature is in `X-Content-Signature` or the `sig` query parameter.
- Parsed webhook enums are numeric: test environment `1`, payment success `2`.
  Do not compare `result.eventData.event` to a string.
- Do not fulfil orders from the success redirect. Verify the webhook and reject
  wrong projects. Separate test orders from production fulfilment.
- `BitsnapBackend.setApiKey` configures notifications, not checkout/HMAC.

## Verify

1. Configure a test gateway and make a test purchase using a project API key for
   test checkout. Current keys have no separate test/live prefix.
2. Confirm a Test webhook arrives and its signature verifies. Confirm tampering
   fails. Deduplicate verified events before deployment.
3. Build the site and grep the actual secrets in the built client bundle and
   source maps. Set nonempty secret env vars privately; never print them.

```sh
grep -rFq -- "$BITSNAP_API_KEY" .next/static
grep -rFq -- "$BITSNAP_WEBHOOK_SECRET" .next/static
# Astro with Node: use dist/client/_astro instead of .next/static.
```

Exit 0 means a leak, 1 means no match, 2 means a search error. Check your adapter's
actual client output path. Fix leaks and rotate exposed keys before deploying.

## Full recipes

- [Next.js](https://docs.bitsnap.pl/en/guides/nextjs/)
- [Astro](https://docs.bitsnap.pl/en/guides/astro/)
- [SDK reference](https://docs.bitsnap.pl/en/reference/example/)
- [MCP](https://docs.bitsnap.pl/en/guides/mcp/)
- [bitsnap-integrate skill](https://docs.bitsnap.pl/skills/bitsnap-integrate/SKILL.md)
