import { fromJson } from "@bufbuild/protobuf";
import crypto from "crypto";
import {
  type IntegrationEventJob,
  IntegrationEventJobSchema,
} from "src/gen/proto/jobs/v1/integration_event_job_pb";
import { Err } from "./checkout/lib/err";

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

  if (signature != calculatedSignature) {
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

type ReturnType =
  | (Err & { isErr: true })
  | (IntegrationEventJob & { isErr: false });
