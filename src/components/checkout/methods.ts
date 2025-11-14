import { HOST } from "./constants";
import { buildURL } from "./helper.methods";
import { Err } from "./lib/err";
import { LinkRequest } from "./link.request.schema";

export namespace Bitsnap {

  export async function createPaymentURL(projectID: string, request: LinkRequest) {

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
    projectID: string,
    request: LinkRequest & { apiKey?: string; testMode?: boolean },
  ) {
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
}
