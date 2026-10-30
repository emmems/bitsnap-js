// Compile-time check, never imported at runtime: the hand-written API types
// must stay assignable to the JSON types protoc-gen-es generates from the
// protos (run proto.sh after a proto change, then `pnpm build`).
import type { GetAccountResponseJson } from "../gen/proto/bitsnap/v1/account_pb";
import type {
  CreateCheckoutLinkRequestJson,
  CreateCheckoutLinkResponseJson,
  SettleTestPaymentRequestJson,
  SettleTestPaymentResponseJson,
} from "../gen/proto/bitsnap/v1/checkout_pb";
import type {
  CreateCouponCodeRequestJson,
  CreateCouponRequestJson,
  ListCouponsResponseJson,
  UpdateCouponCodeRequestJson,
  UpdateCouponRequestJson,
} from "../gen/proto/bitsnap/v1/coupons_pb";
import type {
  ListOrdersRequestJson,
  ListOrdersResponseJson,
  OrderJson,
} from "../gen/proto/bitsnap/v1/orders_pb";
import type {
  CreateProductRequestJson,
  ListProductsRequestJson,
  ListProductsResponseJson,
  ProductJson,
  UpdateProductRequestJson,
} from "../gen/proto/bitsnap/v1/products_pb";
import type {
  GetSalesSummaryRequestJson,
  GetSalesSummaryResponseJson,
} from "../gen/proto/bitsnap/v1/stats_pb";
import type {
  CreateWebhookRequestJson,
  CreateWebhookResponseJson,
  ListWebhooksResponseJson,
} from "../gen/proto/bitsnap/v1/webhooks_pb";
import type * as T from "./types";

type Assignable<Sub extends Super, Super> = Sub;

// Requests are sent to the API, so they must be accepted by the generated type.
export type RequestChecks = [
  Assignable<T.ListProductsRequest, ListProductsRequestJson>,
  Assignable<T.CreateProductRequest, CreateProductRequestJson>,
  Assignable<T.UpdateProductRequest, UpdateProductRequestJson>,
  Assignable<T.ListOrdersRequest, ListOrdersRequestJson>,
  Assignable<T.CreateCouponRequest, CreateCouponRequestJson>,
  Assignable<T.UpdateCouponRequest, UpdateCouponRequestJson>,
  Assignable<T.CreateCouponCodeRequest, CreateCouponCodeRequestJson>,
  Assignable<T.UpdateCouponCodeRequest, UpdateCouponCodeRequestJson>,
  Assignable<T.CreateWebhookRequest, CreateWebhookRequestJson>,
  Assignable<T.CreateCheckoutLinkRequest, CreateCheckoutLinkRequestJson>,
  Assignable<T.SettleTestPaymentRequest, SettleTestPaymentRequestJson>,
  Assignable<T.GetSalesSummaryRequest, GetSalesSummaryRequestJson>,
];

// Responses come from the API, so they must be assignable to the generated
// type (which marks every field optional).
export type ResponseChecks = [
  Assignable<T.GetAccountResponse, GetAccountResponseJson>,
  Assignable<T.Product, ProductJson>,
  Assignable<T.ListProductsResponse, ListProductsResponseJson>,
  Assignable<T.Order, OrderJson>,
  Assignable<T.ListOrdersResponse, ListOrdersResponseJson>,
  Assignable<T.ListCouponsResponse, ListCouponsResponseJson>,
  Assignable<T.ListWebhooksResponse, ListWebhooksResponseJson>,
  Assignable<T.CreateWebhookResponse, CreateWebhookResponseJson>,
  Assignable<T.CreateCheckoutLinkResponse, CreateCheckoutLinkResponseJson>,
  Assignable<T.SettleTestPaymentResponse, SettleTestPaymentResponseJson>,
  Assignable<T.GetSalesSummaryResponse, GetSalesSummaryResponseJson>,
];
