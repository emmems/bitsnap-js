export type BitsnapApiErrorInit = {
  /** HTTP status of the response. */
  status: number;
  /** Parsed JSON body, or the raw text when the body is not JSON. */
  body: unknown;
  /** Connect error code, e.g. `permission_denied`, `not_found`, `aborted`. */
  code?: string;
  /** Stable machine-readable reason, e.g. `revision_conflict`, `missing_scope`. */
  reason?: string;
  /** Extra facts of the error, e.g. `{ scope: "products:write" }`. */
  metadata?: Record<string, string>;
  /** Value of the `X-Request-ID` response header; quote it when you report a problem. */
  requestId?: string;
  /** The server's message without the `[reason]` prefix. */
  detail?: string;
};

/**
 * Thrown by the public API client (`createBitsnapClient`) and by the
 * `BitsnapBackend` calls that use it, on every non-2xx response.
 *
 * Branch on `reason` (stable), not on `message`:
 *
 * ```ts
 * try { await client.products.update(...) }
 * catch (e) {
 *   if (e instanceof BitsnapApiError && e.reason === "revision_conflict") { ... }
 * }
 * ```
 */
export class BitsnapApiError extends Error {
  /**
   * Every entry point (`bitsnap-js`, `/backend`, `/client`, `/errors`) is
   * bundled on its own and carries its own copy of this class, so a plain
   * `instanceof` would fail across entries. This brand makes `instanceof
   * BitsnapApiError` true for errors from any copy.
   */
  readonly isBitsnapApiError = true;
  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { isBitsnapApiError?: unknown }).isBitsnapApiError === true
    );
  }

  readonly status: number;
  /**
   * The reason in the upper-case form of 1.x, e.g. `REVISION_CONFLICT`,
   * `MISSING_SCOPE`, kept so code written for 1.x keeps working. Prefer
   * `reason`.
   */
  readonly code?: string;
  /** Connect error code, e.g. `permission_denied`, `aborted`. */
  readonly connectCode?: string;
  /** Stable reason from the API, e.g. `writes_disabled`; undefined for errors that carry none. */
  readonly reason?: string;
  readonly metadata: Record<string, string>;
  readonly requestId?: string;
  /** The server's message without the `[reason]` prefix. */
  readonly detail?: string;
  /** Parsed JSON body, or raw text when the body is not JSON. */
  readonly body: unknown;

  constructor(init: BitsnapApiErrorInit);
  /** @deprecated The 1.x signature; pass a `BitsnapApiErrorInit` instead. */
  constructor(status: number, body: unknown, code?: string);
  constructor(
    initOrStatus: BitsnapApiErrorInit | number,
    legacyBody?: unknown,
    legacyCode?: string,
  ) {
    const init: BitsnapApiErrorInit =
      typeof initOrStatus === "number"
        ? {
            status: initOrStatus,
            body: legacyBody,
            reason: legacyCode?.toLowerCase(),
          }
        : initOrStatus;
    const label = init.reason ?? init.code;
    super(
      `Bitsnap API error ${init.status}${label ? ` (${label})` : ""}` +
        (init.detail ? `: ${init.detail}` : ""),
    );
    this.name = "BitsnapApiError";
    this.status = init.status;
    this.connectCode = init.code;
    this.code = init.reason?.toUpperCase() ?? (typeof initOrStatus === "number" ? legacyCode : undefined);
    this.reason = init.reason;
    this.metadata = init.metadata ?? {};
    this.requestId = init.requestId;
    this.detail = init.detail;
    this.body = init.body;
  }

  /** Builds the error from a failed response of the public API. */
  static fromResponse(
    status: number,
    body: unknown,
    requestId?: string,
  ): BitsnapApiError {
    const parsed =
      body != null && typeof body === "object"
        ? (body as { code?: unknown; message?: unknown; details?: unknown })
        : {};
    const message = typeof parsed.message === "string" ? parsed.message : undefined;
    let reason = message ? /^\[([a-z_]+)\]/.exec(message)?.[1] : undefined;
    let metadata: Record<string, string> | undefined;
    if (Array.isArray(parsed.details)) {
      for (const entry of parsed.details) {
        const debug = (entry as { debug?: { reason?: unknown; metadata?: unknown } })
          ?.debug;
        if (debug && typeof debug.reason === "string") {
          reason = debug.reason;
          if (debug.metadata && typeof debug.metadata === "object") {
            metadata = debug.metadata as Record<string, string>;
          }
          break;
        }
      }
    }
    return new BitsnapApiError({
      status,
      body,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      reason,
      metadata,
      requestId,
      detail: message?.replace(/^\[[a-z_]+\]\s*/, ""),
    });
  }
}
