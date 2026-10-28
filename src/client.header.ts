import type { Interceptor } from "@connectrpc/connect";

// Replaced by tsup `define` at build time (see tsup.config.ts).
declare const PACKAGE_VERSION: string | undefined;

export const CLIENT_HEADER_NAME = "X-Bitsnap-Client";

const version =
  typeof PACKAGE_VERSION === "string" ? PACKAGE_VERSION : "0.0.0-dev";

export const CLIENT_HEADER_VALUE = `bitsnap-js@${version}`;

/** Spread into the `headers` of any fetch call to the bitsnap API. */
export const clientHeaders: Record<string, string> = {
  [CLIENT_HEADER_NAME]: CLIENT_HEADER_VALUE,
};

/** Connect interceptor adding the client header to every RPC. */
export const clientHeaderInterceptor: Interceptor = (next) => (req) => {
  req.header.set(CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE);
  return next(req);
};
