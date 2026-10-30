import { clientHeaders } from "./client.header";
import { BitsnapApiError } from "./errors";
import type * as T from "./public-v1/types";

export type * from "./public-v1/types";

const DEFAULT_HOST = "https://bitsnap.pl";
const DEFAULT_TIMEOUT_MS = 30_000;

export type BitsnapClientOptions = {
  /**
   * A project API key: `bs_test_…` (test mode, no real money) or `bs_live_…`.
   * Server-side only; the API refuses browser origins.
   */
  apiKey: string;
  /** Default `https://bitsnap.pl`. */
  host?: string;
  /** Replace `fetch` (tests, proxies, custom agents). */
  fetch?: typeof fetch;
  /** Abort a request after this many ms. Default 30000. */
  timeoutMs?: number;
  /** Extra headers sent with every request (they cannot replace Authorization). */
  headers?: Record<string, string>;
};

export type RequestOptions = {
  /**
   * Writes send an `Idempotency-Key`. Default: a random UUID per call. Pass
   * your own, and reuse it on a retry of the same request, to make the retry
   * safe: the API returns the first result instead of creating a second order.
   */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type BitsnapClient = ReturnType<typeof createBitsnapClient>;

/** "test" for `bs_test_…`, "live" for `bs_live_…` and legacy `api_…` keys, else undefined. */
function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** An AbortSignal that fires when `ms` pass or `signal` aborts, whichever is first. */
function deadline(ms: number, signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Bitsnap request timed out after ${ms} ms`)),
    ms,
  );
  const onAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function keyEnvironment(apiKey: string): "test" | "live" | undefined {
  if (apiKey.startsWith("bs_test_")) return "test";
  if (apiKey.startsWith("bs_live_") || apiKey.startsWith("api_")) return "live";
  return undefined;
}

/**
 * Client of the Bitsnap public merchant API (`/api/v1`): plain `fetch` with
 * Connect JSON, no other dependencies. Use it on the server only.
 *
 * ```ts
 * const bitsnap = createBitsnapClient({ apiKey: process.env.BITSNAP_API_KEY! });
 * const { products } = await bitsnap.products.list({ limit: 10 });
 * const { url, orderId } = await bitsnap.checkout.createCheckoutLink({
 *   items: [{ productId: products[0].id }],
 *   successUrl: "http://localhost:3000/thanks",
 * });
 * await bitsnap.checkout.settleTestPayment({ orderId, outcome: "TEST_PAYMENT_OUTCOME_PAID" }); // test keys only
 * ```
 *
 * Failures throw `BitsnapApiError` (`status`, `code`, `reason`, `requestId`).
 */
export function createBitsnapClient(options: BitsnapClientOptions) {
  const apiKey = options.apiKey;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("createBitsnapClient: apiKey is required (bs_test_… or bs_live_…).");
  }
  const host = (options.host ?? DEFAULT_HOST).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call<Res>(
    service: string,
    method: string,
    body: unknown,
    write: boolean,
    opts: RequestOptions | undefined,
  ): Promise<Res> {
    const headers: Record<string, string> = {
      ...clientHeaders,
      ...options.headers,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (write) {
      headers["Idempotency-Key"] = opts?.idempotencyKey ?? uuid();
    }
    const limit = deadline(timeoutMs, opts?.signal);
    let response: Response;
    let text: string;
    try {
      response = await (options.fetch ?? globalThis.fetch)(
        `${host}/api/v1/bitsnap.v1.${service}/${method}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body ?? {}),
          signal: limit.signal,
        },
      );
      text = await response.text();
    } finally {
      limit.done();
    }
    let parsed: unknown = text;
    try {
      parsed = text === "" ? {} : JSON.parse(text);
    } catch {}
    if (!response.ok) {
      throw BitsnapApiError.fromResponse(
        response.status,
        parsed,
        response.headers.get("x-request-id") ?? undefined,
      );
    }
    return parsed as Res;
  }

  const read =
    <Req, Res>(service: string, method: string) =>
    (request?: Req, opts?: RequestOptions) =>
      call<Res>(service, method, request, false, opts);
  const write =
    <Req, Res>(service: string, method: string) =>
    (request: Req, opts?: RequestOptions) =>
      call<Res>(service, method, request, true, opts);

  return {
    /** "test" or "live", read from the key prefix; undefined for other tokens. */
    environment: keyEnvironment(apiKey),
    host,

    account: {
      /** The project, environment and scopes of the key. Needs no scope. */
      get: read<undefined, T.GetAccountResponse>("AccountService", "GetAccount"),
    },

    products: {
      /** Products of the project, newest first. Scope `products:read`. */
      list: read<T.ListProductsRequest, T.ListProductsResponse>("ProductsService", "ListProducts"),
      get: (id: string, opts?: RequestOptions) =>
        call<T.GetProductResponse>("ProductsService", "GetProduct", { id }, false, opts),
      /** Scope `products:write` and the key's write switch. Idempotent with `Idempotency-Key`. */
      create: write<T.CreateProductRequest, T.CreateProductResponse>("ProductsService", "CreateProduct"),
      update: write<T.UpdateProductRequest, T.UpdateProductResponse>("ProductsService", "UpdateProduct"),
    },

    orders: {
      list: read<T.ListOrdersRequest, T.ListOrdersResponse>("OrdersService", "ListOrders"),
      get: (id: string, opts?: RequestOptions) =>
        call<T.GetOrderResponse>("OrdersService", "GetOrder", { id }, false, opts),
    },

    coupons: {
      list: read<undefined, T.ListCouponsResponse>("CouponsService", "ListCoupons"),
      create: write<T.CreateCouponRequest, T.CreateCouponResponse>("CouponsService", "CreateCoupon"),
      update: write<T.UpdateCouponRequest, T.UpdateCouponResponse>("CouponsService", "UpdateCoupon"),
      delete: write<T.DeleteCouponRequest, T.DeleteCouponResponse>("CouponsService", "DeleteCoupon"),
      createCode: write<T.CreateCouponCodeRequest, T.CreateCouponCodeResponse>("CouponsService", "CreateCouponCode"),
      updateCode: write<T.UpdateCouponCodeRequest, T.UpdateCouponCodeResponse>("CouponsService", "UpdateCouponCode"),
      deleteCode: write<T.DeleteCouponCodeRequest, T.DeleteCouponCodeResponse>("CouponsService", "DeleteCouponCode"),
    },

    webhooks: {
      list: read<undefined, T.ListWebhooksResponse>("WebhooksService", "ListWebhooks"),
      /** The response carries the `signingSecret` once; store it as BITSNAP_WEBHOOK_SECRET. */
      create: write<T.CreateWebhookRequest, T.CreateWebhookResponse>("WebhooksService", "CreateWebhook"),
      delete: write<T.DeleteWebhookRequest, T.DeleteWebhookResponse>("WebhooksService", "DeleteWebhook"),
    },

    checkout: {
      /**
       * Creates an order for existing products and returns the URL the buyer
       * pays at. A test key creates a test-mode order that moves no money.
       * Scope `checkout:create`.
       */
      createCheckoutLink: write<T.CreateCheckoutLinkRequest, T.CreateCheckoutLinkResponse>(
        "CheckoutService",
        "CreateCheckoutLink",
      ),
      /**
       * Settles a test-mode order as paid or failed, as if the buyer's payment
       * came through; its webhooks and emails fire. Test keys only: a live key
       * fails with reason `test_mode_only`.
       */
      settleTestPayment: write<T.SettleTestPaymentRequest, T.SettleTestPaymentResponse>(
        "CheckoutService",
        "SettleTestPayment",
      ),
    },

    stats: {
      getSalesSummary: read<T.GetSalesSummaryRequest, T.GetSalesSummaryResponse>(
        "StatsService",
        "GetSalesSummary",
      ),
    },
  };
}
