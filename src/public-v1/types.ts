// Types of the Bitsnap public merchant API (`/api/v1`, proto package bitsnap.v1).
//
// Wire format is Connect JSON: lowerCamelCase field names, enums as their
// names, timestamps as RFC 3339 strings. Money is an integer in the minor unit
// of its currency (4900 PLN = 49.00 zł). Responses always spell out empty
// lists and zero values; `optional` proto fields are absent when unset.
//
// These types are written by hand so request fields can be optional where the
// API has a default and response fields are required where the API always
// sends them. `types.check.ts` compiles them against the types generated from
// the protos (src/gen/proto/bitsnap/v1), so a proto change that these types
// miss fails the build.

export type Environment =
  | "ENVIRONMENT_UNSPECIFIED"
  | "ENVIRONMENT_TEST"
  | "ENVIRONMENT_LIVE";

export type Money = { amount: number; currency: string };

// ---- account ---------------------------------------------------------------

export type CredentialType =
  | "CREDENTIAL_TYPE_UNSPECIFIED"
  | "CREDENTIAL_TYPE_API_KEY"
  | "CREDENTIAL_TYPE_OAUTH";

export type GetAccountResponse = {
  projectId: string;
  projectName: string;
  environment: Environment;
  credentialType: CredentialType;
  scopes: string[];
  canWrite: boolean;
};

// ---- products --------------------------------------------------------------

export type ProductStatus =
  | "PRODUCT_STATUS_UNSPECIFIED"
  | "PRODUCT_STATUS_DRAFT"
  | "PRODUCT_STATUS_UNPUBLISHED"
  | "PRODUCT_STATUS_PUBLISHED";

export type Variant = {
  id: string;
  name: string;
  price?: Money;
  availableQuantity?: number;
};

export type Product = {
  id: string;
  name: string;
  status: ProductStatus;
  price?: Money;
  availableQuantity?: number;
  images: string[];
  variants: Variant[];
  /** Version of the product; send it back in `updateProduct` to detect concurrent edits. */
  revision: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ListProductsRequest = {
  search?: string;
  /** 1 to 100; default 50. */
  limit?: number;
  cursor?: string;
  /** False (default): only PUBLISHED products. */
  includeDrafts?: boolean;
};
export type ListProductsResponse = { products: Product[]; nextCursor: string };

export type GetProductResponse = { product: Product };

export type VariantInput = {
  /** Id of an existing variant to change; omit to create a new one. */
  id?: string;
  name: string;
  /** `currency` may be empty: the product's currency is used. */
  price: { amount: number; currency?: string };
  availableQuantity?: number;
};

export type CreateProductRequest = {
  name: string;
  price: Money;
  /** Default: draft. */
  status?: ProductStatus;
  availableQuantity?: number;
  images?: string[];
  variants?: VariantInput[];
};
export type CreateProductResponse = { product: Product };

export type UpdateProductRequest = {
  id: string;
  /** The revision you last read; a mismatch fails with reason `revision_conflict`. */
  revision?: number;
  name?: string;
  price?: Money;
  status?: ProductStatus;
  availableQuantity?: number;
  /** Replaces all images when not empty. */
  images?: string[];
  /** Replaces all variants when not empty; unlisted variants are removed. */
  variants?: VariantInput[];
};
export type UpdateProductResponse = { product: Product };

// ---- orders ----------------------------------------------------------------

export type OrderStatus =
  | "ORDER_STATUS_UNSPECIFIED"
  | "ORDER_STATUS_CREATED"
  | "ORDER_STATUS_PAID"
  | "ORDER_STATUS_UNPAID"
  | "ORDER_STATUS_CANCELED"
  | "ORDER_STATUS_SENT"
  | "ORDER_STATUS_COMPLETED"
  | "ORDER_STATUS_ISSUE"
  | "ORDER_STATUS_RETURNED"
  | "ORDER_STATUS_IN_PROGRESS";

export type Customer = { email: string; name: string; phone: string };

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice?: Money;
};

export type Order = {
  id: string;
  status: OrderStatus;
  environment: Environment;
  createdAt?: string;
  customer?: Customer;
  items: OrderItem[];
  total?: Money;
  paymentGateway: string;
  couponCode: string;
  deliveryPrice?: Money;
};

export type ListOrdersRequest = {
  limit?: number;
  cursor?: string;
  /** RFC 3339. */
  createdFrom?: string;
  createdTo?: string;
  statuses?: OrderStatus[];
  productIds?: string[];
  /** Searching customer data needs the `customers:pii` scope. */
  search?: string;
};
export type ListOrdersResponse = {
  orders: Order[];
  nextCursor: string;
  totalCount: number;
};

export type GetOrderResponse = { order: Order };

// ---- coupons ---------------------------------------------------------------

export type Discount = { percentOff: number } | { amountOff: Money };

export type CouponCode = {
  id: string;
  code: string;
  maxRedemptions?: number;
  minimumOrderAmount?: number;
  expiresAt?: string;
  createdAt?: string;
};

export type Coupon = {
  id: string;
  name: string;
  discount?: { percentOff?: number; amountOff?: Money };
  includesDelivery: boolean;
  productIds: string[];
  expiresAt?: string;
  createdAt?: string;
  codes: CouponCode[];
};

export type ListCouponsResponse = { coupons: Coupon[] };

export type CreateCouponRequest = {
  name: string;
  discount: Discount;
  includesDelivery?: boolean;
  productIds?: string[];
  expiresAt?: string;
};
export type CreateCouponResponse = { id: string };

export type UpdateCouponRequest = CreateCouponRequest & { id: string };
export type UpdateCouponResponse = { id: string };

export type DeleteCouponRequest = { id: string };
export type DeleteCouponResponse = Record<string, never>;

export type CreateCouponCodeRequest = {
  couponId: string;
  code: string;
  maxRedemptions?: number;
  minimumOrderAmount?: number;
  expiresAt?: string;
};
export type CreateCouponCodeResponse = { id: string };

export type UpdateCouponCodeRequest = {
  id: string;
  code: string;
  maxRedemptions?: number;
  minimumOrderAmount?: number;
  expiresAt?: string;
};
export type UpdateCouponCodeResponse = { id: string };

export type DeleteCouponCodeRequest = { id: string };
export type DeleteCouponCodeResponse = Record<string, never>;

// ---- webhooks --------------------------------------------------------------

export type Webhook = {
  id: string;
  name: string;
  url: string;
  /** Event types, e.g. `TRANSACTION_SUCCESS`; `ALL` means every event. */
  events: string[];
  environment: Environment;
};

export type ListWebhooksResponse = { webhooks: Webhook[] };

export type CreateWebhookRequest = {
  name?: string;
  /** A public https URL. */
  url: string;
  /** Empty or `["ALL"]`: every event. */
  events?: string[];
};
export type CreateWebhookResponse = { webhook: Webhook; signingSecret: string };

export type DeleteWebhookRequest = { id: string };
export type DeleteWebhookResponse = Record<string, never>;

// ---- checkout --------------------------------------------------------------

export type CheckoutItem = {
  /** Id of a product, or of one of its variants. */
  productId: string;
  /** Default 1. */
  quantity?: number;
};

export type CreateCheckoutLinkRequest = {
  items: CheckoutItem[];
  customerEmail?: string;
  /** Absolute https URL (a test key may use http://localhost). */
  successUrl?: string;
  cancelUrl?: string;
  /** Your own reference, stored with the order (max 200 characters). */
  clientReferenceId?: string;
};
export type CreateCheckoutLinkResponse = {
  url: string;
  /** Empty when the gateway creates the order only after payment. */
  orderId: string;
  environment: Environment;
};

export type TestPaymentOutcome =
  | "TEST_PAYMENT_OUTCOME_UNSPECIFIED"
  | "TEST_PAYMENT_OUTCOME_PAID"
  | "TEST_PAYMENT_OUTCOME_FAILED";

export type SettleTestPaymentRequest = {
  orderId: string;
  outcome: Exclude<TestPaymentOutcome, "TEST_PAYMENT_OUTCOME_UNSPECIFIED">;
};
export type SettleTestPaymentResponse = {
  orderId: string;
  outcome: TestPaymentOutcome;
};

// ---- stats -----------------------------------------------------------------

export type GetSalesSummaryRequest = {
  /** RFC 3339. Default: 30 days before `to`. */
  from?: string;
  /** RFC 3339. Default: now. */
  to?: string;
  productIds?: string[];
};

export type DailySales = { date: string; units: number; revenue: Money[] };

export type GetSalesSummaryResponse = {
  from?: string;
  to?: string;
  orders: number;
  unitsSold: number;
  revenue: Money[];
  daily: DailySales[];
};

// ---- chat ------------------------------------------------------------------
//
// The creator side of the paid chat (`bitsnap.v1.ChatService`). Reads need the
// `chat:read` scope, writes `chat:write` plus the key's write switch.
// Timestamps are RFC 3339 strings; fields that are unset are empty strings or
// absent (`lastMessage`, `expiresAt`, `resolvedAt`).

export type ChatWhoCanPost = "creator" | "members";
export type ChatNotifyDefault = "off" | "email" | "push";
export type ChatReportStatus = "open" | "resolved";
export type ChatReportReason = "spam" | "abuse" | "illegal" | "other";

export type CreateBuyerTokenRequest = {
  /** The customer's e-mail address (matched case-insensitively). */
  email: string;
  /** Lifetime of the token, 60 to 3600 seconds. Default 900. */
  ttlSeconds?: number;
};
export type CreateBuyerTokenResponse = {
  /** `bcht_…`. Hand it to the chat widget in the browser; treat it like a password. */
  token: string;
  /** RFC 3339. */
  expiresAt: string;
};

export type ChatChannel = {
  id: string;
  name: string;
  topic: string;
  welcome: string;
  whoCanPost: ChatWhoCanPost | (string & {});
  /** The Community product the channel is bound to; empty for a free channel. */
  productId: string;
  memberCount: number;
  createdAt?: string;
  bannedWords: string[];
  blockLinks: boolean;
  blockMedia: boolean;
  cooldownSeconds: number;
};

export type ListChatChannelsResponse = { channels: ChatChannel[] };

export type CreateChatChannelRequest = {
  name: string;
  topic?: string;
  welcome?: string;
  /** Default `creator`. */
  whoCanPost?: ChatWhoCanPost;
  /** A Community product to bind (`prodv2_…`); one channel per product. */
  productId?: string;
  bannedWords?: string[];
  blockLinks?: boolean;
  blockMedia?: boolean;
  cooldownSeconds?: number;
};
export type CreateChatChannelResponse = { channel: ChatChannel };

export type UpdateChatChannelRequest = {
  channelId: string;
  name?: string;
  topic?: string;
  welcome?: string;
  whoCanPost?: ChatWhoCanPost;
  /** A product id to bind, `""` to unbind. */
  productId?: string;
  /** `{ words: [] }` clears the list; omit the field to leave it as it is. */
  bannedWords?: { words: string[] };
  blockLinks?: boolean;
  blockMedia?: boolean;
  cooldownSeconds?: number;
};
export type UpdateChatChannelResponse = { channel: ChatChannel };

export type RemoveFromChatChannelRequest = { channelId: string; email: string };
export type RemoveFromChatChannelResponse = Record<string, never>;

export type ChatSettings = {
  awayNotice: string;
  awayEnabled: boolean;
  notifyDefault: ChatNotifyDefault | (string & {});
};
export type GetChatSettingsResponse = { settings: ChatSettings };
export type UpdateChatSettingsRequest = {
  awayNotice?: string;
  awayEnabled?: boolean;
  notifyDefault?: ChatNotifyDefault;
};
export type UpdateChatSettingsResponse = { settings: ChatSettings };

export type ChatBlock = { email: string; createdAt?: string };
export type ListChatBlocksResponse = { blocks: ChatBlock[] };
export type PutChatBlockRequest = { email: string };
export type PutChatBlockResponse = { block: ChatBlock };
export type DeleteChatBlockRequest = { email: string };
export type DeleteChatBlockResponse = Record<string, never>;

export type ChatReport = {
  id: string;
  threadId: string;
  /** The reported message; empty when the report names none. */
  messageId: string;
  reporterEmail: string;
  reason: ChatReportReason | (string & {});
  note: string;
  status: ChatReportStatus | (string & {});
  createdAt?: string;
  resolvedAt?: string;
};
export type ListChatReportsRequest = {
  /** Empty or omitted lists both. */
  status?: ChatReportStatus;
  /** 1 to 100; default 50. */
  limit?: number;
};
export type ListChatReportsResponse = { reports: ChatReport[] };
export type UpdateChatReportRequest = { reportId: string; status: ChatReportStatus };
export type UpdateChatReportResponse = { report: ChatReport };

export type ChatPack = {
  orderId: string;
  productId: string;
  replies: number;
  used: number;
  left: number;
  /** Absent when the pack never expires. */
  expiresAt?: string;
  expired: boolean;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  authorEmail: string;
  /** Empty for a deleted message. */
  body: string;
  attachmentKey: string;
  /** `image` or `video`; empty when there is no attachment. */
  attachmentKind: string;
  createdAt?: string;
  pinned: boolean;
  deleted: boolean;
  /** A note the service wrote itself (the away note). */
  system: boolean;
  /** `pending` while the message is queued. */
  status: string;
};

export type ChatThread = {
  id: string;
  /** `pack` (private thread with a buyer) or `channel`. */
  kind: "pack" | "channel" | (string & {});
  channelId: string;
  title: string;
  lastMessage?: ChatMessage;
  unread: number;
  repliesTotal: number;
  repliesUsed: number;
  repliesLeft: number;
  expiresAt?: string;
  /** True when you cannot answer: no replies left on a pack. */
  composerLocked: boolean;
  productId: string;
  buyerEmail: string;
  /** Response time you promise, in hours; 0 = none. */
  responseHours: number;
  packs: ChatPack[];
};
export type ListChatThreadsResponse = { threads: ChatThread[] };

export type ListChatMessagesRequest = {
  threadId: string;
  /** Id of the oldest message you already have; returns older ones. */
  before?: string;
  /** 1 to 100; default 50. */
  limit?: number;
};
export type ListChatMessagesResponse = {
  /** Newest first. */
  messages: ChatMessage[];
  hasMore: boolean;
};

export type ReplyToChatThreadRequest = {
  threadId: string;
  /** Text only, up to 8000 characters. */
  body: string;
  /** A UUID you choose; a retry with the same id queues the message once. */
  clientId?: string;
};
export type ReplyToChatThreadResponse = {
  /** The accepted message, `status: "pending"`. */
  message: ChatMessage;
  /** Replies left in the pack (0 outside a pack thread). */
  repliesLeft: number;
  composerLocked: boolean;
};
