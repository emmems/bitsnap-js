import { create } from "@bufbuild/protobuf";
import zod from "zod";
import {
  NotifyUserAboutProductAvailabilityRequest,
  NotifyUserAboutProductAvailabilityRequestSchema,
} from "./gen/proto/public/v1/public_api_pb";
import { clientHeaders } from "./client.header";
import { BitsnapApiError } from "./errors";
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

export async function getProduct(
  projectID: string,
  id: string,
  requestInit?: RequestInit
) {
  try {
    const payload = {
      "0": {
        projectID: projectID,
        id: id,
      },
    };

    const encodedPayload = new URLSearchParams();
    encodedPayload.set("batch", "1");
    encodedPayload.set("input", JSON.stringify(payload));

    const result = await fetch(
      BACKEND_HOST +
        "/api/trpc/product.getProductById?" +
        encodedPayload.toString(),
      {
        ...(requestInit ?? {}),
        headers: {
          ...(requestInit?.headers ?? {}),
          ...clientHeaders,
          "Content-Type": "application/json",
          Priority: "u=3, i",
        },
      }
    );

    const downloadedPayload = await result.json();

    const parsedResult = await BitsnapModels.ProductResultSchema.parseAsync(
      downloadedPayload
    );

    if (parsedResult.length == 0) {
      return undefined;
    }
    const parsed = parsedResult[0];

    const response = parsed.result;
    return response;
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
}

export async function getProducts(
  projectID: string,
  limit: number,
  offset: number,
  requestInit?: RequestInit,
  opts?: {
    groupVariants?: boolean;
  }
) {
  try {
    const productsPayload: { [key: string]: any } = {
      "0": {
        projectID: projectID,
        limit: limit,
        offset: offset,
      },
    };

    if (opts) {
      if (opts.groupVariants != null) {
        productsPayload[0]["groupVariants"] = opts.groupVariants;
      }
    }

    const encodedPayload = new URLSearchParams();
    encodedPayload.set("batch", "1");
    encodedPayload.set("input", JSON.stringify(productsPayload));

    const result = await fetch(
      BACKEND_HOST +
        "/api/trpc/product.getProductGrid?" +
        encodedPayload.toString(),
      {
        ...(requestInit ?? {}),
        headers: {
          ...(requestInit?.headers ?? {}),
          ...clientHeaders,
          "Content-Type": "application/json",
          Priority: "u=3, i",
        },
      }
    );

    const downloadedPayload = await result.json();

    try {
      const parsedResult =
        await BitsnapModels.ProductsResultElementSchema.parseAsync(
          downloadedPayload
        );
      const parsed = parsedResult[0];

      const response = parsed.result;
      return response;
    } catch (error) {
      console.error("Error parsing products result:", JSON.stringify(error));
      throw error;
    }
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
// - A 409 (`code === "REVISION_CONFLICT"`) means the product changed since you
//   read it: re-fetch and retry.
// - The API key needs the write switch enabled in the dashboard (products:write).
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

async function productsRequest<T extends zod.ZodTypeAny>(
  projectID: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  schema: T,
  body?: unknown,
  requestInit?: RequestInit
): Promise<zod.infer<T>> {
  const key = requireApiKey();
  const response = await fetch(
    `${BACKEND_HOST}/api/integrations/${encodeURIComponent(projectID)}/products${path}`,
    {
      ...(requestInit ?? {}),
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(requestInit?.headers ?? {}),
        ...clientHeaders,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: "Bearer " + key,
      },
    }
  );
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text === "" ? undefined : JSON.parse(text);
  } catch {}

  if (!response.ok) {
    const code =
      parsed != null &&
      typeof parsed === "object" &&
      typeof (parsed as { error?: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : undefined;
    throw new BitsnapApiError(response.status, parsed, code);
  }
  return schema.parseAsync(parsed);
}

/** Fetches a product via the API-key endpoint, including its `revision`. Throws BitsnapApiError (404 PRODUCT_NOT_FOUND). */
export async function getManagedProduct(
  projectID: string,
  productID: string,
  requestInit?: RequestInit
): Promise<ManagedProduct> {
  return productsRequest(
    projectID,
    "/" + encodeURIComponent(productID),
    "GET",
    managedProductSchema,
    undefined,
    requestInit
  );
}

/** Creates a product (needs products:write). Prices in minor units; see notes above on availableQuantity. */
export async function createProduct(
  projectID: string,
  input: CreateProductInput,
  requestInit?: RequestInit
): Promise<ProductWriteResult> {
  return productsRequest(
    projectID,
    "",
    "POST",
    productWriteResultSchema,
    input,
    requestInit
  );
}

/**
 * Patches a product; only provided fields change. `variants` REPLACES the whole
 * list (omitted variants are deleted; a matching `id` keeps its other fields).
 * On 409 REVISION_CONFLICT re-fetch and retry.
 */
export async function updateProduct(
  projectID: string,
  productID: string,
  patch: UpdateProductInput,
  requestInit?: RequestInit
): Promise<ProductWriteResult> {
  return productsRequest(
    projectID,
    "/" + encodeURIComponent(productID),
    "PATCH",
    productWriteResultSchema,
    patch,
    requestInit
  );
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

export { BitsnapApiError };
