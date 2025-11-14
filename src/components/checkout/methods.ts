import { getCheckoutMethods, getProjectID } from "./CartProvider";
import { HOST } from "./constants";
import { buildURL } from "./helper.methods";
import { Err } from "./lib/err";
import { LinkRequest } from "./link.request.schema";
import { useCheckoutStore } from "./state";

// deprecated, use Bitsnap.addProductToCart()
export async function addProductToCart(
  id: string,
  quantity: number = 1,
  metadata?: Record<string, string | undefined>,
) {
  return Bitsnap.addProductToCart(id, quantity, metadata);
}

// deprecated, use Bitsnap.showCart()
export function showCart() {
  return Bitsnap.showCart();
}

// deprecated, use Bitsnap.hideCart()
export function hideCart() {
  return Bitsnap.hideCart();
}

export namespace Bitsnap {
  export async function addProductToCart(
    id: string,
    quantity: number = 1,
    metadata?: Record<string, string | undefined>,
  ) {
    const projectID = getProjectID();
    if (projectID == null) {
      throw new Error("No project ID found");
    }

    const methods = getCheckoutMethods(projectID);

    const err = await methods.addProduct({
      productID: id,
      quantity: quantity,
      metadata: metadata,
    });
    if (err != null) {
      return err;
    }

    return undefined;
  }

  export function showCart() {
    useCheckoutStore.setState({ isCartVisible: true });
  }

  export function hideCart() {
    useCheckoutStore.setState({ isCartVisible: false });
  }
}

export async function createPaymentURL(request: LinkRequest) {
  const projectID = getProjectID();
  if (projectID == null) {
    throw new Error("No project ID found");
  }

  request = injectReferenceToRequestIfNeeded(request);

  const result = await fetch(buildURL(projectID, "/buy"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (result.status != 200) {
    console.warn(
      "result",
      await result.text(),
      result.status,
      result.statusText,
    );
    return Err("internal-error", "internal");
  }

  const response: { url: string; sessionID: string } = await result.json();

  return {
    url: response.url,
  };
}

export async function createCheckout(
  request: LinkRequest & { apiKey?: string; testMode?: boolean },
) {
  const projectID = getProjectID();
  if (projectID == null) {
    throw new Error("No project ID found");
  }

  const headers = {
    "Content-Type": "application/json",
    ...(request.apiKey != null
      ? { Authorization: `Bearer ${request.apiKey}` }
      : {}),
  };

  const path = request.testMode
    ? `/api/payment/link/auto/${projectID}/test`
    : `/api/payment/link/auto/${projectID}`;

  delete request.apiKey;
  delete request.testMode;

  const response = await fetch(HOST + path, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  const payload: {
    url: string;
  } = await response.json();

  return {
    status: "ok",
    redirectURL: payload.url,
  };
}

export function getReferenceIfPossible(): string | undefined {
  if (typeof localStorage == "undefined") {
    return undefined;
  }
  const refLink = localStorage.getItem("bitsnap-ref");
  if (refLink == null) {
    return undefined;
  }
  return refLink;
}

export function injectReferenceToRequestIfNeeded(
  request: LinkRequest,
): LinkRequest {
  const ref = getReferenceIfPossible();
  if (ref == null) {
    return request;
  }

  if (request.metadata == null) {
    request.metadata = {};
  }
  request.metadata["ref"] = ref;
  return request;
}
