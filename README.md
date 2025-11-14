# Bitsnap JS Backend Library

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

#### `BitsnapBackend.getProducts(projectID: string, limit: number, offset: number, requestInit?: RequestInit, opts?: { groupVariants?: boolean })`

Fetches a list of products with pagination.

```typescript
import { BitsnapBackend } from "bitsnap-js/backend";

const result = await BitsnapBackend.getProducts(
  "your-project-id",
  10, // limit
  0,  // offset
  undefined, // requestInit (optional)
  { groupVariants: true } // options (optional)
);

console.log("Products:", result.products);
console.log("Categories:", result.categories);
```

### Notification Methods

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
