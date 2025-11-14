import { create } from "@bufbuild/protobuf";
import zod from "zod";
import {
  NotifyUserAboutProductAvailabilityRequest,
  NotifyUserAboutProductAvailabilityRequestSchema,
} from "./gen/proto/public/v1/public_api_pb";
import { BitsnapModels } from "./models";
import { PublicApiClient } from "./public.api.backend";

let BACKEND_HOST = "https://bitsnap.pl";
let API_KEY: string | undefined;

export namespace BitsnapBackend {
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
    requestInit?: RequestInit,
  ) {
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
          "Content-Type": "application/json",
          Priority: "u=3, i",
        },
      },
    );

    const downloadedPayload = await result.json();

    const parsedResult =
      await BitsnapModels.ProductResultSchema.parseAsync(downloadedPayload);

    if (parsedResult.length == 0) {
      return undefined;
    }
    const parsed = parsedResult[0];

    return parsed.result;
  }

  export async function getProducts(
    projectID: string,
    limit: number,
    offset: number,
    requestInit?: RequestInit,
    opts?: {
      groupVariants?: boolean;
    },
  ) {
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
          "Content-Type": "application/json",
          Priority: "u=3, i",
        },
      },
    );

    const downloadedPayload = await result.json();

    try {
      const parsedResult =
        await BitsnapModels.ProductsResultElementSchema.parseAsync(
          downloadedPayload,
        );
      if (parsedResult.length == 0) {
        return {
          categories: undefined,
          products: undefined,
        };
      }
      const parsed = parsedResult[0];

      return parsed.result;
    } catch (error) {
      console.error("Error parsing products result:", JSON.stringify(error));
      throw error;
    }
  }

  export async function sendNotification(
    request: NotificationRequest,
    requestInit?: RequestInit,
  ) {
    if (API_KEY == null || API_KEY == "") {
      throw new Error(
        'use BitsnapBackend.setApiKey("{{API_KEY}} to setup api key before using this method.")',
      );
    }
    const result = await fetch(BACKEND_HOST + "/api/notification/send", {
      ...(requestInit ?? {}),
      method: "POST",
      body: JSON.stringify(request),
      headers: {
        ...(requestInit?.headers ?? {}),
        "Content-Type": "application/json",
        Authorization: "Bearer " + API_KEY,
      },
    });

    if (result.status != 200) {
      console.warn(
        "error while sending notification",
        result.status,
        await result.text(),
      );
      return "failure";
    }
    return "success";
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
    },
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
      await PublicApiClient.get(
        BACKEND_HOST,
      ).notifyUserAboutProductAvailability(req, opts);
      return {
        status: "success",
      };
    } catch (e: any) {
      console.log("error while sending notification", e);
      return {
        status: "failure",
        message: "failed-to-notify",
      };
    }
  }
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
