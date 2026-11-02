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
  ChatBlockJson,
  ChatChannelJson,
  ChatChannelMemberJson,
  ChatMessageJson,
  ChatReportJson,
  ChatSettingsJson,
  ChatThreadJson,
  CreateBuyerTokenRequestJson,
  CreateBuyerTokenResponseJson,
  CreateChatChannelRequestJson,
  DeleteChatBlockRequestJson,
  DeleteChatChannelRequestJson,
  ListChatChannelMembersRequestJson,
  ListChatChannelMembersResponseJson,
  ListChatMessagesRequestJson,
  ListChatMessagesResponseJson,
  ListChatReportsRequestJson,
  PutChatBlockRequestJson,
  RemoveFromChatChannelRequestJson,
  ReplyToChatThreadRequestJson,
  ReplyToChatThreadResponseJson,
  UpdateChatChannelRequestJson,
  UpdateChatReportRequestJson,
  UpdateChatSettingsRequestJson,
} from "../gen/proto/bitsnap/v1/chat_pb";
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
  ArchivePaymentLinkRequestJson,
  ArchivePaymentLinkResponseJson,
  CreatePaymentLinkRequestJson,
  CreatePaymentLinkResponseJson,
  GetPaymentLinkRequestJson,
  GetPaymentLinkResponseJson,
  ListPaymentLinksRequestJson,
  ListPaymentLinksResponseJson,
  PaymentLinkJson,
  SendPaymentLinkRequestJson,
  SendPaymentLinkResponseJson,
} from "../gen/proto/bitsnap/v1/payment_links_pb";
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
  Assignable<T.CreateBuyerTokenRequest, CreateBuyerTokenRequestJson>,
  Assignable<T.CreateChatChannelRequest, CreateChatChannelRequestJson>,
  Assignable<T.UpdateChatChannelRequest, UpdateChatChannelRequestJson>,
  Assignable<T.RemoveFromChatChannelRequest, RemoveFromChatChannelRequestJson>,
  Assignable<T.ListChatChannelMembersRequest, ListChatChannelMembersRequestJson>,
  Assignable<T.DeleteChatChannelRequest, DeleteChatChannelRequestJson>,
  Assignable<T.UpdateChatSettingsRequest, UpdateChatSettingsRequestJson>,
  Assignable<T.PutChatBlockRequest, PutChatBlockRequestJson>,
  Assignable<T.DeleteChatBlockRequest, DeleteChatBlockRequestJson>,
  Assignable<T.ListChatReportsRequest, ListChatReportsRequestJson>,
  Assignable<T.UpdateChatReportRequest, UpdateChatReportRequestJson>,
  Assignable<T.ListChatMessagesRequest, ListChatMessagesRequestJson>,
  Assignable<T.ReplyToChatThreadRequest, ReplyToChatThreadRequestJson>,
  Assignable<T.CreatePaymentLinkRequest, CreatePaymentLinkRequestJson>,
  Assignable<T.GetPaymentLinkRequest, GetPaymentLinkRequestJson>,
  Assignable<T.ListPaymentLinksRequest, ListPaymentLinksRequestJson>,
  Assignable<T.ArchivePaymentLinkRequest, ArchivePaymentLinkRequestJson>,
  Assignable<T.SendPaymentLinkRequest, SendPaymentLinkRequestJson>,
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
  Assignable<T.CreateBuyerTokenResponse, CreateBuyerTokenResponseJson>,
  Assignable<T.ChatChannel, ChatChannelJson>,
  Assignable<T.ChatChannelMember, ChatChannelMemberJson>,
  Assignable<T.ListChatChannelMembersResponse, ListChatChannelMembersResponseJson>,
  Assignable<T.ChatSettings, ChatSettingsJson>,
  Assignable<T.ChatBlock, ChatBlockJson>,
  Assignable<T.ChatReport, ChatReportJson>,
  Assignable<T.ChatMessage, ChatMessageJson>,
  Assignable<T.ChatThread, ChatThreadJson>,
  Assignable<T.ListChatMessagesResponse, ListChatMessagesResponseJson>,
  Assignable<T.ReplyToChatThreadResponse, ReplyToChatThreadResponseJson>,
  Assignable<T.PaymentLink, PaymentLinkJson>,
  Assignable<T.CreatePaymentLinkResponse, CreatePaymentLinkResponseJson>,
  Assignable<T.GetPaymentLinkResponse, GetPaymentLinkResponseJson>,
  Assignable<T.ListPaymentLinksResponse, ListPaymentLinksResponseJson>,
  Assignable<T.ArchivePaymentLinkResponse, ArchivePaymentLinkResponseJson>,
  Assignable<T.SendPaymentLinkResponse, SendPaymentLinkResponseJson>,
];
