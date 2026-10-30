import { create } from "@bufbuild/protobuf";
import zod from "zod";
import {
  NotifyUserAboutProductAvailabilityRequest,
  NotifyUserAboutProductAvailabilityRequestSchema,
} from "./gen/proto/public/v1/public_api_pb";
import { createBitsnapClient } from "./client";
import { clientHeaders } from "./client.header";
import { BitsnapApiError } from "./errors";
import type * as ApiV1 from "./public-v1/types";
import { BitsnapModels } from "./models";
import { PublicApiClient } from "./public.api.backend";

let BACKEND_HOST = "https://bitsnap.pl";
let API_KEY: string | undefined;

export async function setCustomHost(host: string) {
  BACKEND_HOST = host;
}
export function getHost() {
  return BACKEND_HOST;
}
export async function setApiKey(apiKey: string) {
  API_KEY = apiKey;
}

/** Headers/signal of a caller's `requestInit`, for the API client. */
function requestInitHeaders(requestInit?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  new Headers(requestInit?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

async function publicGet(
  path: string,
  requestInit?: RequestInit
): Promise<unknown> {
  const response = await fetch(BACKEND_HOST + path, {
    ...(requestInit ?? {}),
    method: "GET",
    headers: {
      ...requestInitHeaders(requestInit),
      ...clientHeaders,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text === "" ? undefined : JSON.parse(text);
  } catch {}
  if (!response.ok) {
    throw BitsnapApiError.fromResponse(
      response.status,
      parsed,
      response.headers.get("x-request-id") ?? undefined
    );
  }
  return parsed;
}

const publicProductsSchema = zod.object({
  success: zod.boolean().optional(),
  message: zod.string().optional(),
  result: zod.array(BitsnapModels.ItemSchema),
});

const publicListSchema = zod.object({
  items: zod.array(
    zod.object({
      id: zod.string(),
      name: zod.string(),
      shortDescription: zod.string().nullable().optional(),
      image: zod.object({ url: zod.string() }).nullable().optional(),
      price: zod.number(),
      currency: zod.string(),
      cartItemId: zod.string().optional(),
    })
  ),
  totalCount: zod.number(),
});

/** Public product details by id, as the storefront sees them (no API key). */
async function fetchPublicProducts(
  projectID: string,
  ids: string[],
  requestInit?: RequestInit
): Promise<BitsnapModels.Item[]> {
  const parsed = publicProductsSchema.parse(
    await publicGet(
      `/api/integrations/${encodeURIComponent(projectID)}/public-commerce/products?ids=${encodeURIComponent(ids.join(","))}`,
      requestInit
    )
  );
  return parsed.result;
}

export async function getProduct(
  projectID: string,
  id: string,
  requestInit?: RequestInit
) {
  try {
    const [product] = await fetchPublicProducts(projectID, [id], requestInit);
    if (product == null) {
      return {
        data: {
          success: false,
          message: "Product not found",
          result: undefined as BitsnapModels.Item | undefined,
        },
      };
    }
    return {
      data: {
        success: true,
        message: undefined as string | undefined,
        result: product as BitsnapModels.Item | undefined,
      },
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
}

/** The storefront page size limit of `public-commerce/product-list`. */
const PUBLIC_LIST_PAGE_SIZE = 48;

async function getPublicProducts(
  projectID: string,
  limit: number,
  offset: number,
  requestInit?: RequestInit
): Promise<BitsnapModels.Data> {
  const listed: zod.infer<typeof publicListSchema>["items"] = [];
  let totalCount = 0;
  let next = offset;
  while (listed.length < limit) {
    const page = publicListSchema.parse(
      await publicGet(
        `/api/integrations/${encodeURIComponent(projectID)}/public-commerce/product-list?` +
          new URLSearchParams({
            limit: String(Math.min(PUBLIC_LIST_PAGE_SIZE, limit - listed.length)),
            offset: String(next),
          }).toString(),
        requestInit
      )
    );
    totalCount = page.totalCount;
    listed.push(...page.items);
    next += page.items.length;
    if (page.items.length === 0 || next >= totalCount) break;
  }

  // The list is a slim card; the details (variants, pricing, description)
  // come from the products endpoint, the same data the old grid carried.
  const details: BitsnapModels.Item[] = [];
  for (let i = 0; i < listed.length; i += PUBLIC_LIST_PAGE_SIZE) {
    details.push(
      ...(await fetchPublicProducts(
        projectID,
        listed.slice(i, i + PUBLIC_LIST_PAGE_SIZE).map((p) => p.cartItemId ?? p.id),
        requestInit
      ))
    );
  }
  const result = listed.map((card): BitsnapModels.Item => {
    const match =
      details.find((d) => d.id === (card.cartItemId ?? card.id)) ??
      details.find((d) => d.id === card.id || d.id.startsWith(card.id + "_"));
    if (match) return match;
    return {
      id: card.id,
      name: card.name,
      description: card.shortDescription ?? null,
      price: card.price,
      currency: card.currency,
      image_url: card.image?.url ?? "",
      images: card.image ? [card.image.url] : [],
      isPublished: true,
    };
  });
  return { success: true, result, totalCount };
}

/** Product of the API (API key) as the item shape the SDK has always returned. */
function itemFromApiProduct(product: ApiV1.Product): BitsnapModels.Item {
  const currency = product.price?.currency ?? "PLN";
  return {
    id: product.id,
    name: product.name,
    price: product.price?.amount ?? 0,
    currency,
    image_url: product.images[0] ?? "",
    images: product.images,
    isPublished: product.status === "PRODUCT_STATUS_PUBLISHED",
    availableQuantity: product.availableQuantity,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: variant.price?.amount ?? 0,
      currency: variant.price?.currency ?? currency,
      images: [],
      availableQuantity: variant.availableQuantity,
    })),
  };
}

async function getProductsWithDrafts(
  limit: number,
  offset: number,
  requestInit?: RequestInit
): Promise<BitsnapModels.Data> {
  const client = apiClient(requestInit);
  const wanted = offset + limit;
  const products: ApiV1.Product[] = [];
  let cursor = "";
  do {
    const page = await client.products.list(
      {
        includeDrafts: true,
        limit: Math.min(100, wanted - products.length),
        ...(cursor === "" ? {} : { cursor }),
      },
      { signal: requestInit?.signal ?? undefined }
    );
    products.push(...page.products);
    cursor = page.nextCursor;
  } while (cursor !== "" && products.length < wanted);

  // The API pages by cursor and has no total: when more pages exist the count
  // is a lower bound that still says "there is a next page".
  const totalCount = cursor === "" ? products.length : wanted + 1;
  return {
    success: true,
    result: products.slice(offset, wanted).map(itemFromApiProduct),
    totalCount,
  };
}

export async function getProducts(
  projectID: string,
  limit: number,
  offset: number,
  requestInit?: RequestInit,
  opts?: {
    /** No effect: the public list has one row per product. Kept for compatibility. */
    groupVariants?: boolean;
    includeDrafts?: boolean;
  }
) {
  const includeDrafts = opts?.includeDrafts === true;

  if (includeDrafts && (API_KEY == null || API_KEY == "")) {
    throw new Error(
      "getProducts with includeDrafts requires an API key: call " +
        'BitsnapBackend.setApiKey("{{API_KEY}}") before using this option.'
    );
  }

  try {
    return {
      data: includeDrafts
        ? await getProductsWithDrafts(limit, offset, requestInit)
        : await getPublicProducts(projectID, limit, offset, requestInit),
    };
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}

export async function sendNotification(
  request: NotificationRequest,
  requestInit?: RequestInit
) {
  if (API_KEY == null || API_KEY == "") {
    throw new Error(
      'use BitsnapBackend.setApiKey("{{API_KEY}} to setup api key before using this method.")'
    );
  }

  try {
    const result = await fetch(BACKEND_HOST + "/api/notification/send", {
      ...(requestInit ?? {}),
      method: "POST",
      body: JSON.stringify(request),
      headers: {
        ...(requestInit?.headers ?? {}),
        ...clientHeaders,
        "Content-Type": "application/json",
        Authorization: "Bearer " + API_KEY,
      },
    });

    if (result.status != 200) {
      console.warn(
        "error while sending notification",
        result.status,
        await result.text()
      );
      const response = "failure";
      return response;
    }
    const response = "success";
    return response;
  } catch (error) {
    console.error("Error sending notification:", error);
    return "failure";
  }
}

export async function notifyProductAvailability(
  request: Pick<
    NotifyUserAboutProductAvailabilityRequest,
    "productId" | "email" | "projectId"
  >,
  opts?: {
    headers?: Headers;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<{
  status: "success" | "failure";
  message?: "failed-to-notify";
}> {
  const req = create(NotifyUserAboutProductAvailabilityRequestSchema, {
    productId: request.productId,
    email: request.email,
    projectId: request.projectId,
  });

  try {
    await PublicApiClient.get(BACKEND_HOST).notifyUserAboutProductAvailability(
      req,
      opts
    );
    const response = {
      status: "success" as const,
    };

    return response;
  } catch (e: any) {
    console.error("error while sending notification", e);
    return {
      status: "failure",
      message: "failed-to-notify",
    };
  }
}

// ---------------------------------------------------------------------------
// Managed products (API key, server-side only)
//
// - Prices are integers in minor units (1999 = 19.99 PLN).
// - `availableQuantity` is the TOTAL stock cap; units already sold or reserved
//   are counted against it (remaining = cap - sold - reserved). Send the total
//   you want to allow, not a delta.
// - A 409 (`reason === "revision_conflict"`) means the product changed since you
//   read it: re-fetch and retry.
// - The API key needs the write switch enabled in the dashboard (products:write).
// - These calls use the public API (`/api/v1`, see `createBitsnapClient`): the
//   key (`bs_test_…` / `bs_live_…`) identifies the project, so the `projectID`
//   argument is accepted for compatibility and not sent. Writes carry an
//   auto-generated Idempotency-Key.
// ---------------------------------------------------------------------------

const managedStatusSchema = zod.enum(["DRAFT", "UNPUBLISHED", "PUBLISHED"]);

const managedVariantSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  priceAmount: zod.number().nullable(),
  priceCurrency: zod.string().nullable(),
  availableQuantity: zod.number().nullable(),
});

const managedProductSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  status: managedStatusSchema,
  priceAmount: zod.number().nullable(),
  priceCurrency: zod.string().nullable(),
  availableQuantity: zod.number().nullable(),
  images: zod.array(zod.string()),
  variants: zod.array(managedVariantSchema),
  revision: zod.number(),
});

const productWriteResultSchema = zod.object({
  id: zod.string(),
  revision: zod.number(),
});

export type ManagedProduct = zod.infer<typeof managedProductSchema>;
export type ManagedProductVariant = zod.infer<typeof managedVariantSchema>;
export type ProductWriteResult = zod.infer<typeof productWriteResultSchema>;
export type ManagedProductStatus = zod.infer<typeof managedStatusSchema>;

/** Variant input. With `id` it replaces that variant; without it a new one is created. */
export type ProductVariantInput = {
  id?: string;
  name: string;
  priceAmount: number;
  priceCurrency?: string;
  availableQuantity?: number;
};

export type CreateProductInput = {
  name: string;
  priceAmount: number;
  priceCurrency: string;
  images?: string[];
  availableQuantity?: number;
  status?: ManagedProductStatus;
  variants?: ProductVariantInput[];
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  /** Optimistic concurrency token. Mismatch -> BitsnapApiError 409 REVISION_CONFLICT. */
  revision?: number;
};

type WriteOpts = { revision?: number; requestInit?: RequestInit };

function requireApiKey() {
  if (API_KEY == null || API_KEY == "") {
    throw new Error(
      'use BitsnapBackend.setApiKey("{{API_KEY}} to setup api key before using this method.")'
    );
  }
  return API_KEY;
}

/** A public API client for the configured host and key; `requestInit` headers are added to each call. */
function apiClient(requestInit?: RequestInit) {
  return createBitsnapClient({
    apiKey: requireApiKey(),
    host: BACKEND_HOST,
    headers: requestInitHeaders(requestInit),
  });
}

const statusToApi: Record<ManagedProductStatus, ApiV1.ProductStatus> = {
  DRAFT: "PRODUCT_STATUS_DRAFT",
  UNPUBLISHED: "PRODUCT_STATUS_UNPUBLISHED",
  PUBLISHED: "PRODUCT_STATUS_PUBLISHED",
};

function managedFromApi(product: ApiV1.Product): ManagedProduct {
  const status = product.status.replace("PRODUCT_STATUS_", "");
  return managedProductSchema.parse({
    id: product.id,
    name: product.name,
    status: status === "UNSPECIFIED" ? "DRAFT" : status,
    priceAmount: product.price?.amount ?? null,
    priceCurrency: product.price?.currency ?? null,
    availableQuantity: product.availableQuantity ?? null,
    images: product.images,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceAmount: variant.price?.amount ?? null,
      priceCurrency: variant.price?.currency ?? null,
      availableQuantity: variant.availableQuantity ?? null,
    })),
    revision: product.revision,
  });
}

function variantToApi(variant: ProductVariantInput): ApiV1.VariantInput {
  return {
    ...(variant.id != null ? { id: variant.id } : {}),
    name: variant.name,
    price: {
      amount: variant.priceAmount,
      ...(variant.priceCurrency != null ? { currency: variant.priceCurrency } : {}),
    },
    ...(variant.availableQuantity != null
      ? { availableQuantity: variant.availableQuantity }
      : {}),
  };
}

function writeResult(product: ApiV1.Product): ProductWriteResult {
  return { id: product.id, revision: product.revision };
}

/** Fetches a product via the API-key endpoint, including its `revision`. Throws BitsnapApiError (404, reason product_not_found). */
export async function getManagedProduct(
  projectID: string,
  productID: string,
  requestInit?: RequestInit
): Promise<ManagedProduct> {
  void projectID;
  const { product } = await apiClient(requestInit).products.get(productID, {
    signal: requestInit?.signal ?? undefined,
  });
  return managedFromApi(product);
}

/** Creates a product (needs products:write). Prices in minor units; see notes above on availableQuantity. */
export async function createProduct(
  projectID: string,
  input: CreateProductInput,
  requestInit?: RequestInit
): Promise<ProductWriteResult> {
  void projectID;
  const { product } = await apiClient(requestInit).products.create(
    {
      name: input.name,
      price: { amount: input.priceAmount, currency: input.priceCurrency },
      ...(input.status != null ? { status: statusToApi[input.status] } : {}),
      ...(input.availableQuantity != null
        ? { availableQuantity: input.availableQuantity }
        : {}),
      ...(input.images != null ? { images: input.images } : {}),
      ...(input.variants != null
        ? { variants: input.variants.map(variantToApi) }
        : {}),
    },
    { signal: requestInit?.signal ?? undefined }
  );
  return writeResult(product);
}

/**
 * Patches a product; only provided fields change. `variants` REPLACES the whole
 * list (omitted variants are deleted; a matching `id` keeps its other fields).
 * On 409 (reason revision_conflict) re-fetch and retry.
 */
export async function updateProduct(
  projectID: string,
  productID: string,
  patch: UpdateProductInput,
  requestInit?: RequestInit
): Promise<ProductWriteResult> {
  const client = apiClient(requestInit);
  const signal = requestInit?.signal ?? undefined;

  let price: ApiV1.Money | undefined;
  if (patch.priceAmount != null || patch.priceCurrency != null) {
    // The API sets amount and currency together; fill in the half not given.
    if (patch.priceAmount == null || patch.priceCurrency == null) {
      const current = (await client.products.get(productID, { signal })).product;
      price = {
        amount: patch.priceAmount ?? current.price?.amount ?? 0,
        currency: patch.priceCurrency ?? current.price?.currency ?? "PLN",
      };
    } else {
      price = { amount: patch.priceAmount, currency: patch.priceCurrency };
    }
  }

  const { product } = await client.products.update(
    {
      id: productID,
      ...(patch.revision != null ? { revision: patch.revision } : {}),
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(price != null ? { price } : {}),
      ...(patch.status != null ? { status: statusToApi[patch.status] } : {}),
      ...(patch.availableQuantity != null
        ? { availableQuantity: patch.availableQuantity }
        : {}),
      ...(patch.images != null ? { images: patch.images } : {}),
      ...(patch.variants != null
        ? { variants: patch.variants.map(variantToApi) }
        : {}),
    },
    { signal }
  );
  void projectID;
  return writeResult(product);
}

function toVariantInput(v: ManagedProductVariant): ProductVariantInput {
  return {
    id: v.id,
    name: v.name,
    priceAmount: v.priceAmount ?? 0,
    ...(v.priceCurrency != null ? { priceCurrency: v.priceCurrency } : {}),
    ...(v.availableQuantity != null
      ? { availableQuantity: v.availableQuantity }
      : {}),
  };
}

async function patchVariants(
  projectID: string,
  productID: string,
  opts: WriteOpts | undefined,
  mutate: (variants: ProductVariantInput[]) => ProductVariantInput[]
) {
  const product = await getManagedProduct(projectID, productID, opts?.requestInit);
  return updateProduct(
    projectID,
    productID,
    {
      revision: opts?.revision ?? product.revision,
      variants: mutate(product.variants.map(toVariantInput)),
    },
    opts?.requestInit
  );
}

/** Replaces the variant with the same `id`, or appends it when `id` is absent/unknown. Reads then patches using the read revision (or opts.revision). */
export async function upsertVariant(
  projectID: string,
  productID: string,
  variant: ProductVariantInput,
  opts?: WriteOpts
): Promise<ProductWriteResult> {
  return patchVariants(projectID, productID, opts, (variants) => {
    const index =
      variant.id == null ? -1 : variants.findIndex((v) => v.id === variant.id);
    if (index === -1) return [...variants, variant];
    return variants.map((v, i) => (i === index ? variant : v));
  });
}

/** Removes a variant by id (read-modify-write with revision). */
export async function deleteVariant(
  projectID: string,
  productID: string,
  variantID: string,
  opts?: WriteOpts
): Promise<ProductWriteResult> {
  return patchVariants(projectID, productID, opts, (variants) =>
    variants.filter((v) => v.id !== variantID)
  );
}

/**
 * Sets the total stock cap (not a delta) for a product, or for one variant when
 * `opts.variantID` is given. Throws Error if the variant does not exist.
 */
export async function setStock(
  projectID: string,
  productID: string,
  availableQuantity: number,
  opts?: WriteOpts & { variantID?: string }
): Promise<ProductWriteResult> {
  const variantID = opts?.variantID;
  if (variantID == null) {
    return updateProduct(
      projectID,
      productID,
      { availableQuantity, revision: opts?.revision },
      opts?.requestInit
    );
  }
  return patchVariants(projectID, productID, opts, (variants) => {
    if (!variants.some((v) => v.id === variantID)) {
      throw new Error(`Variant ${variantID} not found on product ${productID}`);
    }
    return variants.map((v) =>
      v.id === variantID ? { ...v, availableQuantity } : v
    );
  });
}

const notificationTypes = zod.enum(["push", "email", "sms"]);

const notificationRequestSchema = zod.object({
  to: zod.array(zod.string()),
  title: zod.string(),
  body: zod.string().optional(),
  type: zod
    .union([notificationTypes, zod.array(notificationTypes)])
    .default("push"),
  emailOptions: zod
    .object({
      subject: zod.string().optional(),
      replyTo: zod.string().optional(),

      htmlText: zod.string().optional(),
    })
    .optional(),
  advanced: zod
    .object({
      /// This is a boolean flag that indicates whether the notification should be shown in the dashboard. DEFAULT: true.
      showInDashboard: zod.boolean().default(false),
    })
    .optional(),
});
export type NotificationRequest = zod.infer<typeof notificationRequestSchema>;

export const BitsnapBackend = {
  setCustomHost,
  getHost,
  setApiKey,
  getProduct,
  getProducts,
  sendNotification,
  notifyProductAvailability,
  getManagedProduct,
  createProduct,
  updateProduct,
  upsertVariant,
  deleteVariant,
  setStock,
};

export namespace BitsnapBackend {
  export type NotificationRequest = zod.infer<typeof notificationRequestSchema>;
  export type ManagedProduct = zod.infer<typeof managedProductSchema>;
  export type ManagedProductVariant = zod.infer<typeof managedVariantSchema>;
  export type ManagedProductStatus = zod.infer<typeof managedStatusSchema>;
  export type ProductVariantInput = import("./backend").ProductVariantInput;
  export type CreateProductInput = import("./backend").CreateProductInput;
  export type UpdateProductInput = import("./backend").UpdateProductInput;
  export type ProductWriteResult = zod.infer<typeof productWriteResultSchema>;
}

export { BitsnapApiError, createBitsnapClient };
