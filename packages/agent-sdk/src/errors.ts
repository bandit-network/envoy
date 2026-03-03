/**
 * Base error class for all Envoy agent SDK errors.
 */
export class EnvoyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvoyError";
  }
}

/**
 * Thrown when the pairing API returns an error response.
 * The `.code` property contains the API error code (e.g. "UNAUTHORIZED", "BAD_REQUEST").
 */
export class EnvoyPairingError extends EnvoyError {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "EnvoyPairingError";
    this.code = code;
  }
}

/**
 * Thrown when attempting to use an expired token (via getToken or toAuthHeaders).
 * The `.expiredAt` property contains the expiry timestamp.
 */
export class EnvoyTokenExpiredError extends EnvoyError {
  public readonly expiredAt: Date;

  constructor(expiredAt: Date) {
    super(`Token expired at ${expiredAt.toISOString()}`);
    this.name = "EnvoyTokenExpiredError";
    this.expiredAt = expiredAt;
  }
}

/**
 * Thrown when calling a method that requires a paired state
 * before pair() or loadToken() has been called.
 */
export class EnvoyNotPairedError extends EnvoyError {
  constructor() {
    super("Agent is not paired. Call pair() or loadToken() first.");
    this.name = "EnvoyNotPairedError";
  }
}
