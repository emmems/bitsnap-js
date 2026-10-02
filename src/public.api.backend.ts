import type { Transport } from "@connectrpc/connect";
import { createClient, type Client } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { PublicApiService } from "./gen/proto/public/v1/public_api_pb";

export namespace PublicApiClient {
  export function get(host: string): Client<typeof PublicApiService> {
    return createClient(PublicApiService, getTransport(host));
  }

  const transports = new Map<string, Transport>();
  function getTransport(host: string): Transport {
    const baseUrl = host.replace(/\/$/, "") + "/api/rpc";
    let transport = transports.get(baseUrl);
    if (transport == null) {
      transport = createConnectTransport({
        httpVersion: "1.1",
        useBinaryFormat: true,
        baseUrl,
      });
      transports.set(baseUrl, transport);
    }
    return transport;
  }
}
