/** Thrown by BitsnapBackend product management calls on non-2xx responses. */
export class BitsnapApiError extends Error {
  readonly status: number;
  /** Value of the JSON `error` field, e.g. REVISION_CONFLICT, MISSING_SCOPE. */
  readonly code?: string;
  /** Parsed JSON body, or raw text when the body is not JSON. */
  readonly body: unknown;

  constructor(status: number, body: unknown, code?: string) {
    super(`Bitsnap API error ${status}${code ? ` (${code})` : ""}`);
    this.name = "BitsnapApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
