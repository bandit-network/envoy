/** Options for constructing an EnvoyVerifier instance. */
export interface EnvoyVerifierOptions {
  /** Base URL of the Envoy API (e.g., "https://api.useenvoy.dev") */
  issuerUrl: string;
  /** Optional: custom fetch implementation (defaults to global fetch) */
  fetch?: typeof globalThis.fetch;
}

/** Decoded manifest payload from a verified token. */
export interface ManifestPayload {
  agent_name: string;
  agent_id: string;
  owner_ref: string;
  wallet_addresses: string[];
  scopes: string[];
  policy_refs: Record<string, string>;
  issued_at: string;
  expires_at: string;
}

/** Result of token verification. */
export interface VerificationResult {
  /** Whether the token is valid (signature OK, not expired, not revoked). */
  valid: boolean;
  /** The decoded manifest payload, or null if signature verification failed. */
  manifest: ManifestPayload | null;
  /** Whether the token has expired. */
  expired: boolean;
  /** Whether the token has been revoked (only checked with online verification). */
  revoked: boolean;
  /** Scopes granted by the manifest. */
  scopes: string[];
  /** Error message if verification failed. */
  error?: string;
}

/** Options for createMiddleware(). */
export interface MiddlewareOptions {
  /** Required scopes — the token must have all of these. */
  scopes?: string[];
}

/**
 * Thrown when a verified token does not have the required scopes.
 */
export class EnvoyInsufficientScopesError extends Error {
  public readonly required: string[];
  public readonly actual: string[];

  constructor(required: string[], actual: string[]) {
    const missing = required.filter((s) => !actual.includes(s));
    super(`Insufficient scopes: missing ${missing.join(", ")}`);
    this.name = "EnvoyInsufficientScopesError";
    this.required = required;
    this.actual = actual;
  }
}

/**
 * Thrown when token verification fails in middleware.
 */
export class EnvoyVerificationError extends Error {
  public readonly result: VerificationResult;

  constructor(message: string, result: VerificationResult) {
    super(message);
    this.name = "EnvoyVerificationError";
    this.result = result;
  }
}
