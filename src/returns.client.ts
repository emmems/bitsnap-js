import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { Environment } from "./gen/proto/common/v1/environment_pb";
import { ReturnsService } from "./gen/proto/public/v1/returns_pb";

export type ReturnsClientOptions = {
  projectID: string;
  host?: string;
  environment?: Environment;
  fetch?: typeof fetch;
};

/** Browser-safe customer returns API. Each instance keeps its session token private. */
export function createReturnsClient(options: ReturnsClientOptions) {
  const host = (options.host ?? "https://bitsnap.pl").replace(/\/$/, "");
  const client = createClient(
    ReturnsService,
    createConnectTransport({
      baseUrl: `${host}/api/rpc`,
      useBinaryFormat: true,
      fetch: options.fetch,
    }),
  );
  const environment = options.environment ?? Environment.PRODUCTION;
  let sessionToken: string | undefined;
  let expiresAt = 0;

  const requireSession = () => {
    if (!sessionToken || (expiresAt > 0 && Date.now() >= expiresAt)) {
      sessionToken = undefined;
      expiresAt = 0;
      throw new Error("Returns session has expired. Verify your email again.");
    }
    return sessionToken;
  };

  async function withSession<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ConnectError && error.code === Code.Unauthenticated) {
        sessionToken = undefined;
        expiresAt = 0;
      }
      throw error;
    }
  }

  return {
    startSession(email: string) {
      return client.startReturnSession({
        projectId: options.projectID,
        email,
        environment,
      });
    },
    async verifySession(challengeId: string, code: string) {
      const result = await client.verifyReturnSession({
        projectId: options.projectID,
        challengeId,
        code,
        environment,
      });
      sessionToken = result.sessionToken;
      expiresAt = result.expiresAt
        ? Number(result.expiresAt.seconds) * 1000 + result.expiresAt.nanos / 1_000_000
        : 0;
      return result;
    },
    clearSession() {
      sessionToken = undefined;
      expiresAt = 0;
    },
    listOrders(pageSize = 20, pageToken = "") {
      return withSession(() =>
        client.listReturnOrders({
          projectId: options.projectID,
          sessionToken: requireSession(),
          pageSize,
          pageToken,
        }),
      );
    },
    getReturnableOrder(canonicalOrderId: string) {
      return withSession(() =>
        client.getReturnableOrder({
          projectId: options.projectID,
          sessionToken: requireSession(),
          canonicalOrderId,
        }),
      );
    },
    createReturn(
      canonicalOrderId: string,
      items: { lineId: string; quantity: number }[],
      note = "",
      idempotencyKey = crypto.randomUUID(),
    ) {
      return withSession(() =>
        client.createReturnRequest({
          projectId: options.projectID,
          sessionToken: requireSession(),
          canonicalOrderId,
          items,
          note,
          idempotencyKey,
        }),
      );
    },
    listReturns(pageSize = 20, pageToken = "") {
      return withSession(() =>
        client.listMyReturns({
          projectId: options.projectID,
          sessionToken: requireSession(),
          pageSize,
          pageToken,
        }),
      );
    },
    getReturn(returnId: string) {
      return withSession(() =>
        client.getMyReturn({
          projectId: options.projectID,
          sessionToken: requireSession(),
          returnId,
        }),
      );
    },
  };
}
