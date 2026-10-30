# Bitsnap JS Backend Library

## Instructions for coding agents

Read [AGENTS.md](./AGENTS.md) first. Follow the
[Next.js](https://docs.bitsnap.pl/en/guides/nextjs/) or
[Astro](https://docs.bitsnap.pl/en/guides/astro/) recipe. Keep API keys and webhook
secrets on the server. The project ID is public.

The library is designed to provide backend methods for integrating Bitsnap e-commerce functionality into JavaScript/TypeScript backend applications, with focus on:

- Payment processing
- Product management
- Webhook support
- Notification handling

It uses modern libraries like:

- Zod for schema validation
- Protocol Buffers for data serialization
- Connect RPC for API communication

## Capabilities

### Public API client:

- `createBitsnapClient`: products, orders, coupons, webhooks, checkout links, test payments, stats
- Test keys (`bs_test_…`) and the test gateway: settle test orders with `settleTestPayment`
- `Idempotency-Key` on every write, typed `BitsnapApiError`

### Product Management:

- Fetches product details from Bitsnap
- Retrieves product lists with pagination
- Handles product variants
- Supports product availability notifications

### Payment Processing:

- Creates checkout/payment links
- Supports test and production modes
- Handles payment redirects

### Webhook Handling:

- Validates webhook signatures
- Processes webhook events
- Supports HMAC SHA-512 signature verification

### Notifications:

- Sends push, email, and SMS notifications
- Notifies users about product availability
- Configurable notification options

## Installation

```bash
npm install bitsnap-js
# or
pnpm add bitsnap-js
# or
yarn add bitsnap-js
```

## Public API client (`createBitsnapClient`)

`createBitsnapClient` talks to Bitsnap's public merchant API (`/api/v1`): products,
orders, coupons, webhook endpoints, checkout links, test payments, sales stats.
It is plain `fetch` with JSON, has no extra dependencies, and works only on the
server (the API refuses browser origins; a key in a browser is a leaked key).

```ts
import { createBitsnapClient } from "bitsnap-js/client";

const bitsnap = createBitsnapClient({ apiKey: process.env.BITSNAP_API_KEY! });

const { projectName, environment, canWrite } = await bitsnap.account.get();
const { products, nextCursor } = await bitsnap.products.list({ limit: 20 });

const { product } = await bitsnap.products.create({
  name: "Ebook",
  price: { amount: 4900, currency: "PLN" }, // minor units: 49.00 PLN
  status: "PRODUCT_STATUS_PUBLISHED",
});

const { url, orderId } = await bitsnap.checkout.createCheckoutLink({
  items: [{ productId: product.id, quantity: 1 }],
  successUrl: "http://localhost:3000/thanks",
});
```

### Test keys and the test gateway

API keys are created in **Settings → Developer**. A **test key** (`bs_test_…`)
creates **test-mode** orders that move no money, so you can build and test a whole
purchase flow; a **live key** (`bs_live_…`) creates real ones. `client.environment`
says which one a key is (`"test"` / `"live"`).

With a test key you do not need a card: create a checkout link, then settle the
order as if the buyer paid. The order's webhooks and emails fire like a real payment.

```ts
await bitsnap.checkout.settleTestPayment({
  orderId,
  outcome: "TEST_PAYMENT_OUTCOME_PAID", // or "TEST_PAYMENT_OUTCOME_FAILED"
});
```

`settleTestPayment` is refused for live keys (reason `test_mode_only`) and for
orders that are not waiting for a payment (`order_not_settleable`).

### Methods

| Service | Methods |
| --- | --- |
| `account` | `get()` |
| `products` | `list(req)`, `get(id)`, `create(req)`, `update(req)` |
| `orders` | `list(req)`, `get(id)` |
| `coupons` | `list()`, `create`, `update`, `delete`, `createCode`, `updateCode`, `deleteCode` |
| `webhooks` | `list()`, `create(req)` (returns `signingSecret` once), `delete({ id })` |
| `checkout` | `createCheckoutLink(req)`, `settleTestPayment(req)` |
| `stats` | `getSalesSummary(req)` |

Every method returns the API's response message (`{ products, nextCursor }`,
`{ product }`, …) with lowerCamelCase fields, enum names such as
`ORDER_STATUS_PAID` and RFC 3339 timestamps; all types are exported
(`import type { Product } from "bitsnap-js/client"`). Lists use cursors: pass
the `nextCursor` of a page to get the next one (`""` means the last page). Each
call also takes `{ idempotencyKey?, signal? }` as its last argument.

Options of `createBitsnapClient`: `apiKey` (required), `host` (default
`https://bitsnap.pl`), `fetch`, `timeoutMs` (default 30000), `headers`.

### Idempotency-Key

Every write (create/update/delete, `createCheckoutLink`, `settleTestPayment`)
sends an `Idempotency-Key` header: a random UUID per call, or the one you pass.
A retry with the same key and the same body returns the first answer instead of
creating a second product or order; the same key with a different body fails with
reason `idempotency_key_reused`. To make a retry safe, derive the key from your own
operation id and reuse it:

```ts
await bitsnap.checkout.createCheckoutLink(request, { idempotencyKey: `cart-${cartId}` });
```

### Errors

Every failed call throws `BitsnapApiError`:

| Field | Meaning |
| --- | --- |
| `status` | HTTP status |
| `code` | The reason in upper case (`MISSING_SCOPE`, `REVISION_CONFLICT`, …), as in 1.x |
| `connectCode` | Connect code (`permission_denied`, `not_found`, `aborted`, …) |
| `reason` | Stable machine-readable reason: `missing_scope`, `writes_disabled`, `test_mode_only`, `revision_conflict`, `product_not_found`, `rate_limited`, … Branch on this |
| `metadata` | Extra facts, e.g. `{ scope: "products:write" }` |
| `requestId` | `X-Request-ID`; quote it when you report a problem |
| `detail` / `body` | The server's message / the parsed response |

```ts
import { BitsnapApiError } from "bitsnap-js/errors";

try {
  await bitsnap.products.update({ id, revision: 3, name: "New" });
} catch (e) {
  if (e instanceof BitsnapApiError && e.reason === "revision_conflict") {
    // read the product again and retry
  }
}
```

Network failures and timeouts throw the underlying `fetch` error.

## Command line (`bitsnap` CLI)

The same API from a terminal, built for AI coding agents (`--json` on every
command, no prompts, exit codes `0` ok / `1` error / `2` auth / `3` network):

```sh
npx bitsnap login --key bs_test_…
npx bitsnap products create --name Ebook --price 4900 --status published
npx bitsnap checkout create --product prodv2_… --success-url http://localhost:3000/thanks
npx bitsnap payments settle <orderId>                      # test keys only
npx bitsnap webhooks listen --forward http://localhost:3000/api/webhooks
```

`webhooks listen` streams test-mode webhook events and `POST`s each one to your
local route with the real signature (`X-Content-Signature` and `?sig=`), so
`handleWebhook` verifies it unchanged; set the printed secret as
`BITSNAP_WEBHOOK_SECRET`. See the CLI's README (`npm view bitsnap readme`) for all
commands.

## Backend Methods

### Configuration

#### `BitsnapBackend.setCustomHost(host: string)`

Sets a custom host URL for API requests.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

await BitsnapBackend.setCustomHost("https://your-custom-host.com");
```

#### `BitsnapBackend.getHost()`

Gets the current host URL.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

const host = BitsnapBackend.getHost();
console.log(host); // "https://bitsnap.pl" (default)
```

#### `BitsnapBackend.setApiKey(apiKey: string)`

Sets the API key for authenticated requests (required for notification methods).

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

await BitsnapBackend.setApiKey("your-api-key");
```

### Product Methods

Product and variant responses can include `pricing`. Prices are integer minor
units (for example, `1234` means PLN 12.34). `regularPrice` is the undiscounted
amount, `effectivePrice` is the amount currently charged, and
`referencePrice.amount` is the observed 30-day reference amount when history is
available. Percentage discounts use basis points: `1000` means 10%. The
`priceVersion` is an opaque string for identifying the resolved quote; clients
should send it back during checkout when supported, while the server remains
authoritative.

```ts
import { BitsnapModels } from "bitsnap-js/models";

const pricing: BitsnapModels.ProductPricing | undefined = product.pricing;
```

#### `BitsnapBackend.getProduct(projectID: string, id: string, requestInit?: RequestInit)`

Fetches a single product by ID.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

const product = await BitsnapBackend.getProduct(
  "your-project-id",
  "product-id"
);

if (product) {
  console.log("Product:", product);
}
```

#### `BitsnapBackend.getProducts(projectID: string, limit: number, offset: number, requestInit?: RequestInit, opts?: { groupVariants?: boolean; includeDrafts?: boolean })`

Fetches a list of products with pagination. By default only **published**
products come back, read from the public storefront endpoints (no API key).
To receive the project's drafts as well, pass `includeDrafts: true` **and**
configure the project API key with `BitsnapBackend.setApiKey(...)` first: that
path uses the public API (`/api/v1`, `products.list`) and the call throws before
fetching when the key is missing. Each item exposes `isPublished` so drafts can
be told apart from published products.

Notes: `groupVariants` has no effect (the public list has one row per product).
With `includeDrafts` the API pages by cursor, so `offset` is served by reading
pages from the start, items carry the fields the API returns (no `description`,
`pricing` or `metadata`), and `data.totalCount` is exact only on the last page;
while more pages exist it is `offset + limit + 1`, i.e. a lower bound.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

const result = await BitsnapBackend.getProducts(
  "your-project-id",
  10, // limit
  0, // offset
  undefined, // requestInit (optional)
  { groupVariants: true } // options (optional)
);

console.log("Products:", result.data.result);
console.log("Total count:", result.data.totalCount);
```

```typescript
// Drafts need the project API key as well as the option.
await BitsnapBackend.setApiKey(process.env.BITSNAP_API_KEY!);

const withDrafts = await BitsnapBackend.getProducts(
  "your-project-id",
  10,
  0,
  undefined,
  { includeDrafts: true }
);

for (const product of withDrafts.data.result) {
  console.log(product.name, product.isPublished);
}
```

### Notification Methods

#### Managing products (server-side)

Create, update and read products, variants and stock with an API key. The key
needs the **write** switch enabled in the dashboard (grants `products:write`;
`getManagedProduct` also works with `products:read`). Never use it in the browser.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";
import { BitsnapApiError } from "bitsnap-js/errors";

await BitsnapBackend.setApiKey(process.env.BITSNAP_API_KEY!);

const { id } = await BitsnapBackend.createProduct("project-id", {
  name: "T-shirt",
  priceAmount: 4900, // integer minor units (49.00)
  priceCurrency: "PLN",
  availableQuantity: 100,
});

await BitsnapBackend.setStock("project-id", id, 80);
await BitsnapBackend.setStock("project-id", id, 10, { variantID: "variant-id" });
await BitsnapBackend.upsertVariant("project-id", id, { name: "L", priceAmount: 4900 });
await BitsnapBackend.deleteVariant("project-id", id, "variant-id");

try {
  await BitsnapBackend.updateProduct("project-id", id, { revision: 3, name: "New" });
} catch (e) {
  if (e instanceof BitsnapApiError && e.reason === "revision_conflict") {
    // getManagedProduct again and retry
  }
}
```

- `availableQuantity` is the total stock cap (sold and reserved units count against it), not a delta.
- `variants` in `updateProduct` replaces the whole list; omitted variants are deleted.
- These functions call the public API (see `createBitsnapClient`), which needs a
  `bs_test_…` / `bs_live_…` key; the key identifies the project, so the `projectID`
  argument is not sent. Writes carry an `Idempotency-Key`.
- Errors throw `BitsnapApiError` with `status`, `reason` (`missing_scope`, `product_not_found`,
  `revision_conflict`, …), `code` (the reason in upper case, as in 1.x), `connectCode`
  (`permission_denied`, …), `requestId` and `body`. Prefer `reason` in new code.

#### `BitsnapBackend.sendNotification(request: NotificationRequest, requestInit?: RequestInit)`

Sends a notification (push, email, or SMS). Requires API key to be set.

```typescript
import { BitsnapBackend, type NotificationRequest } from "bitsnap-js/backend";

// Set API key first
await BitsnapBackend.setApiKey("your-api-key");

const notification: NotificationRequest = {
  to: ["user@example.com"],
  title: "Order Confirmed",
  body: "Your order has been confirmed",
  type: "email", // or "push", "sms", or ["email", "push"]
  emailOptions: {
    subject: "Order Confirmation",
    htmlText: "<h1>Your order is confirmed!</h1>",
  },
  advanced: {
    showInDashboard: true,
  },
};

const result = await BitsnapBackend.sendNotification(notification);
console.log(result); // "success" or "failure"
```

#### `BitsnapBackend.notifyProductAvailability(request, opts?)`

Notifies a user when a product becomes available.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

const result = await BitsnapBackend.notifyProductAvailability({
  projectId: "your-project-id",
  productId: "product-id",
  email: "user@example.com",
});

if (result.status === "success") {
  console.log("Notification sent successfully");
} else {
  console.error("Failed to notify:", result.message);
}
```

### Checkout Methods

#### `createCheckout(request: LinkRequest & { apiKey?: string; testMode?: boolean })`

Creates a checkout/payment link.

```typescript
import { createCheckout, type LinkRequest } from "bitsnap-js";

const request: LinkRequest = {
  items: [
    {
      id: "product-id",
      quantity: 1,
    },
  ],
  details: {
    email: "customer@example.com",
    name: "John Doe",
    address: {
      name: "John Doe",
      line1: "123 Street",
      city: "City",
      country: "US",
    },
  },
  askForAddress: true,
  askForPhone: true,
  redirect: {
    successURL: "/success",
    cancelURL: "/cancel",
  },
};

const result = await createCheckout({
  ...request,
  apiKey: "your-api-key", // optional
  testMode: true, // optional, defaults to false
});

if (result.status === "ok") {
  // Redirect user to payment page
  return { redirectURL: result.redirectURL };
}
```

### Webhook Handling

#### `handleWebhook(payload: string, url: string, headers: Record<string, string | undefined>, secret: string)`

Handles a webhook request by validating the signature and parsing the payload.

```typescript
import { handleWebhook } from "bitsnap-js";

async function processWebhook(req: Request) {
  const payload = await req.text();
  const url = req.url;
  const headers = Object.fromEntries(req.headers);
  const webhookSecret = "your-webhook-secret";

  const result = await handleWebhook(payload, url, headers, webhookSecret);

  if (result.isErr) {
    console.error("Webhook error:", result.error);
    return new Response("Invalid signature", { status: 401 });
  }

  // Process the webhook event
  const { projectId, environment, eventData } = result;

  switch (eventData?.event) {
    case "TRANSACTION_SUCCESS":
      // Handle successful transaction
      break;
    case "TRANSACTION_FAILURE":
      // Handle failed transaction
      break;
    // Handle other events...
  }

  return new Response("OK", { status: 200 });
}
```

#### `handleWebhookSignature(payload: string, signature: string, secret: string)`

Validates a webhook signature directly (useful when you already have the signature extracted).

```typescript
import { handleWebhookSignature } from "bitsnap-js";

const result = await handleWebhookSignature(
  payload,
  signature,
  "your-webhook-secret"
);

if (result.isErr) {
  console.error("Invalid signature");
} else {
  // Process webhook data
  console.log("Webhook data:", result);
}
```

## Types

### `LinkRequest`

The request type for creating checkout links.

```typescript
import type { LinkRequest } from "bitsnap-js";

const request: LinkRequest = {
  items: [{ id: "product-id", quantity: 1 }],
  askForAddress: true,
  askForPhone: true,
  details: {
    email: "customer@example.com",
  },
};
```

### `NotificationRequest`

The request type for sending notifications.

```typescript
import type { NotificationRequest } from "bitsnap-js/backend";

const notification: NotificationRequest = {
  to: ["user@example.com"],
  title: "Notification Title",
  body: "Notification body",
  type: "email",
};
```

## Complete Example

```typescript
import {
  BitsnapBackend,
  createCheckout,
  handleWebhook,
  type LinkRequest,
  type NotificationRequest,
} from "bitsnap-js";
import type { NotificationRequest as BackendNotificationRequest } from "bitsnap-js/backend";

// Configure backend
await BitsnapBackend.setCustomHost("https://bitsnap.pl");
await BitsnapBackend.setApiKey("your-api-key");

// Get products
const products = await BitsnapBackend.getProducts("project-id", 10, 0);
console.log("Products:", products.products);

// Get single product
const product = await BitsnapBackend.getProduct("project-id", "product-id");
console.log("Product:", product);

// Create checkout link
const checkoutRequest: LinkRequest = {
  items: [{ id: "product-id", quantity: 1 }],
  askForAddress: true,
  details: {
    email: "customer@example.com",
  },
};

const checkoutResult = await createCheckout({
  ...checkoutRequest,
  apiKey: "your-api-key",
  testMode: true,
});

if (checkoutResult.status === "ok") {
  console.log("Checkout URL:", checkoutResult.redirectURL);
}

// Send notification
const notification: BackendNotificationRequest = {
  to: ["user@example.com"],
  title: "Order Confirmed",
  type: "email",
  emailOptions: {
    subject: "Order Confirmation",
  },
};

await BitsnapBackend.sendNotification(notification);

// Handle webhook
async function webhookHandler(req: Request) {
  const payload = await req.text();
  const result = await handleWebhook(
    payload,
    req.url,
    Object.fromEntries(req.headers),
    "webhook-secret"
  );

  if (!result.isErr) {
    // Process webhook event
    console.log("Event:", result.eventData?.event);
  }
}
```
