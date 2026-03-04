import { createRemoteJWKSet, jwtVerify } from "jose";
import type {
  EnvoyVerifierOptions,
  ManifestPayload,
  VerificationResult,
  MiddlewareOptions,
} from "./types";
import {
  EnvoyInsufficientScopesError,
  EnvoyVerificationError,
} from "./types";

export type { EnvoyVerifierOptions, ManifestPayload, VerificationResult, MiddlewareOptions };
export { EnvoyInsufficientScopesError, EnvoyVerificationError };

/**
 * EnvoyVerifier -- Platform SDK for verifying Envoy agent tokens.
 *
 * Usage:
 * ```ts
 * import { EnvoyVerifier } from "@envoy/sdk";
 *
 * const verifier = new EnvoyVerifier({
 *   issuerUrl: "https://api.useenvoy.dev",
 * });
 *
 * const result = await verifier.verify(token);
 * if (result.valid) {
 *   console.log("Agent:", result.manifest.agent_name);
 *   console.log("Scopes:", result.scopes);
 * }
 * ```
 */
export class EnvoyVerifier {
  private readonly issuerUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(options: EnvoyVerifierOptions) {
    // Strip trailing slash
    this.issuerUrl = options.issuerUrl.replace(/\/$/, "");
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  /**
   * Get or create the JWKS key set.
   * jose's createRemoteJWKSet handles caching and key rotation automatically.
   */
  private getJWKS() {
    if (!this.jwks) {
      const jwksUrl = new URL(
        "/.well-known/envoy-issuer",
        this.issuerUrl
      );
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
    return this.jwks;
  }

  /**
   * Verify a manifest token with full online checks.
   * Validates signature, expiry, and revocation status (via API call).
   */
  async verify(token: string): Promise<VerificationResult> {
    // Step 1: Signature + expiry check
    const offlineResult = await this.verifyOffline(token);

    if (!offlineResult.valid || !offlineResult.manifest) {
      return offlineResult;
    }

    // Step 2: Online revocation check
    try {
      const agentId = offlineResult.manifest.agent_id;
      const revocationUrl = `${this.issuerUrl}/api/v1/revocations/${agentId}`;

      const response = await this.fetchFn(revocationUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          success: boolean;
          data?: { revoked: boolean };
        };

        if (data.success && data.data?.revoked) {
          return {
            valid: false,
            manifest: offlineResult.manifest,
            expired: false,
            revoked: true,
            scopes: offlineResult.scopes,
            error: "Token has been revoked",
          };
        }
      }
      // If the revocation endpoint returns 404, the manifest is not revoked
    } catch {
      // If revocation check fails, log but don't block
      console.warn("[envoy-sdk] revocation check failed, proceeding with offline result");
    }

    return offlineResult;
  }

  /**
   * Verify a manifest token offline (signature + expiry only).
   * Does NOT check revocation status. Use for low-latency verification
   * where revocation is checked separately or periodically.
   */
  async verifyOffline(token: string): Promise<VerificationResult> {
    const invalid = (
      error: string,
      extra?: Partial<VerificationResult>
    ): VerificationResult => ({
      valid: false,
      manifest: null,
      expired: false,
      revoked: false,
      scopes: [],
      error,
      ...extra,
    });

    // Step 1: Verify JWS signature
    let payload: ManifestPayload;
    try {
      const jwks = this.getJWKS();
      const { payload: rawPayload } = await jwtVerify(token, jwks);
      payload = rawPayload as unknown as ManifestPayload;
    } catch {
      return invalid("Invalid or malformed token signature");
    }

    // Step 2: Check expiry
    const expiresAt = new Date(payload.expires_at);
    if (expiresAt < new Date()) {
      return {
        valid: false,
        manifest: payload,
        expired: true,
        revoked: false,
        scopes: payload.scopes ?? [],
        error: "Token has expired",
      };
    }

    return {
      valid: true,
      manifest: payload,
      expired: false,
      revoked: false,
      scopes: payload.scopes ?? [],
    };
  }

  /**
   * Check if a verification result has all the required scopes.
   * Returns true if the result's scopes include every scope in `required`.
   */
  hasScopes(result: VerificationResult, required: string[]): boolean {
    return required.every((s) => result.scopes.includes(s));
  }

  /**
   * Assert that a verification result has all the required scopes.
   * Throws EnvoyInsufficientScopesError if any required scope is missing.
   *
   * @throws {EnvoyInsufficientScopesError} If the result is missing required scopes
   */
  requireScopes(result: VerificationResult, required: string[]): void {
    if (!this.hasScopes(result, required)) {
      throw new EnvoyInsufficientScopesError(required, result.scopes);
    }
  }

  /**
   * Create a reusable verification function with optional scope enforcement.
   * Useful for building framework-specific middleware.
   *
   * The returned function verifies the token and optionally checks scopes.
   * On any failure (invalid, expired, revoked, insufficient scopes), it throws.
   *
   * @example
   * ```ts
   * const guard = verifier.createMiddleware({ scopes: ["trade"] });
   *
   * // In your route handler:
   * const result = await guard(bearerToken);
   * console.log(result.manifest.agent_name);
   * ```
   *
   * @throws {EnvoyVerificationError} If the token is invalid, expired, or revoked
   * @throws {EnvoyInsufficientScopesError} If the token lacks required scopes
   */
  createMiddleware(
    options?: MiddlewareOptions
  ): (token: string) => Promise<VerificationResult> {
    return async (token: string): Promise<VerificationResult> => {
      const result = await this.verify(token);

      if (!result.valid) {
        throw new EnvoyVerificationError(
          result.error ?? "Token verification failed",
          result
        );
      }

      if (options?.scopes && options.scopes.length > 0) {
        this.requireScopes(result, options.scopes);
      }

      return result;
    };
  }

  /**
   * Invalidate the cached JWKS. Call this if you suspect key rotation
   * has occurred and the SDK is using stale keys.
   */
  resetKeys(): void {
    this.jwks = null;
  }
}
