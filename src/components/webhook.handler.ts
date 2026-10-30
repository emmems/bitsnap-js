import { fromJson } from "@bufbuild/protobuf";
import crypto from "crypto";
import {
  type IntegrationEventJob,
  IntegrationEventJobSchema,
} from "src/gen/proto/jobs/v1/integration_event_job_pb";
import { Err } from "./checkout/lib/err";

/// Webhook event names, re-exported for consumers. Parsed webhook payloads carry
/// these as numeric enum values, so compare `result.eventData?.event` against
/// `Event.TRANSACTION_SUCCESS` and not against the string "TRANSACTION_SUCCESS".
export { Event } from "src/gen/proto/integrations/v1/event_data_pb";

export async function handleWebhook(
  /// utf-8 encoded json string
  payload: string,
  // url of the webhook can contain signature in query params under key "sig"
  url: string,
  /// Headers or Signature X-Content-Signature
  headers: Record<string, string | undefined>,
  /// webhook secret from admin panel
  secret: string,
) {
  let signature =
    headers?.["x-content-signature"] ?? headers?.["X-Content-Signature"];
  if (signature == null) {
    const parsedUrl = new URL(url);
    signature = parsedUrl.searchParams.get("sig") ?? undefined;
  }

  return handleWebhookSignature(payload, signature ?? "", secret);
}

export async function handleWebhookSignature(
  /// utf-8 encoded json string
  payload: string,
  /// Signature X-Content-Signature
  signature: string,
  /// webhook secret from admin panel
  secret: string,
): Promise<ReturnType> {
  // Validate hmac512 signature
  const hmac = crypto.createHmac("sha512", secret);
  hmac.update(payload);
  const calculatedSignature = hmac.digest("hex");

  if (!signaturesMatch(signature, calculatedSignature)) {
    return {
      ...Err("Invalid signature", "badInput"),
      isErr: true,
    };
  }

  return {
    ...fromJson(IntegrationEventJobSchema, JSON.parse(payload)),
    isErr: false,
  };
}

/// Constant-time string comparison, so a forged signature cannot be discovered
/// byte by byte. Lengths are compared first because `timingSafeEqual` requires
/// equal-length buffers; a valid HMAC-SHA512 hex digest is always 128 characters,
/// so this reveals nothing secret.
function signaturesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

type ReturnType =
  | (Err & { isErr: true })
  | (IntegrationEventJob & { isErr: false });
