import type { EnvoyAgentOptions, ManifestPayload, TokenData } from "./types";
import {
  pairConfirmResponseSchema,
  apiErrorResponseSchema,
  tokenDataSchema,
} from "./types";
import {
  EnvoyError,
  EnvoyPairingError,
  EnvoyTokenExpiredError,
  EnvoyNotPairedError,
} from "./errors";

/**
 * EnvoyAgent -- Agent Runtime SDK for acquiring and presenting Envoy identity tokens.
 *
 * Usage (recommended — no agent ID needed):
 * ```ts
 * import { EnvoyAgent } from "@envoy/agent-sdk";
 *
 * const agent = new EnvoyAgent({
 *   envoyUrl: "https://api.useenvoy.dev",
 *   onTokenReceived: (data) => saveToFile(data),
 * });
 *
 * // Complete pairing — agent ID is resolved automatically
 * await agent.pair(pairingId, secret);
 *
 * // Present identity to platforms
 * const headers = agent.toAuthHeaders();
 * await fetch("https://platform.xyz/api", { headers });
 * ```
 */
export class EnvoyAgent {
  private readonly envoyUrl: string;
  private agentId: string | null;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly onTokenReceived?: (data: TokenData) => void | Promise<void>;

  private tokenData: TokenData | null = null;

  constructor(options: EnvoyAgentOptions) {
    this.envoyUrl = options.envoyUrl.replace(/\/$/, "");
    this.agentId = options.agentId ?? null;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.onTokenReceived = options.onTokenReceived;
  }

  /**
   * Exchange pairing credentials for a signed identity manifest.
   * This is the primary onboarding method — call once after the human
   * operator generates pairing credentials from the Envoy dashboard.
   *
   * If agentId was provided in the constructor, uses the legacy
   * `/agents/:id/pair-confirm` endpoint. Otherwise, uses the direct
   * `/pair-confirm` endpoint which resolves the agent automatically
   * from the pairing record.
   *
   * @param pairingId - UUID of the pairing record
   * @param secret - One-time pairing secret (hex string)
   * @returns The token data containing manifest + signature
   * @throws {EnvoyPairingError} If the API returns an error (invalid secret, expired, etc.)
   * @throws {EnvoyError} If the network request fails or response is malformed
   */
  async pair(pairingId: string, secret: string): Promise<TokenData> {
    // Use direct endpoint when no agent ID is known (preferred)
    // Fall back to legacy endpoint when agent ID is provided
    const url = this.agentId
      ? `${this.envoyUrl}/api/v1/agents/${this.agentId}/pair-confirm`
      : `${this.envoyUrl}/api/v1/pair-confirm`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingId, pairingSecret: secret }),
      });
    } catch (err) {
      throw new EnvoyError(
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Handle error responses
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new EnvoyError(
          `API returned ${response.status} with non-JSON body`
        );
      }

      const errorParsed = apiErrorResponseSchema.safeParse(body);
      if (errorParsed.success) {
        throw new EnvoyPairingError(
          errorParsed.data.error.message,
          errorParsed.data.error.code
        );
      }

      throw new EnvoyError(
        `API returned ${response.status}: ${JSON.stringify(body)}`
      );
    }

    // Parse success response
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new EnvoyError("API returned 200 with non-JSON body");
    }

    const parsed = pairConfirmResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new EnvoyError(
        `Malformed pair-confirm response: ${parsed.error.message}`
      );
    }

    const { data: responseData } = parsed.data;

    const tokenData: TokenData = {
      manifestId: responseData.manifestId,
      manifestJson: responseData.manifestJson as unknown as ManifestPayload,
      signature: responseData.signature,
      expiresAt:
        typeof responseData.expiresAt === "string"
          ? responseData.expiresAt
          : new Date(responseData.expiresAt).toISOString(),
    };

    this.tokenData = tokenData;

    // Resolve agent ID from the manifest if not already set
    if (!this.agentId && tokenData.manifestJson.agent_id) {
      this.agentId = tokenData.manifestJson.agent_id;
    }

    // Invoke persistence callback
    if (this.onTokenReceived) {
      await this.onTokenReceived(tokenData);
    }

    return tokenData;
  }

  /**
   * Restore token state from previously persisted data.
   * Call this on agent startup to restore identity from disk/database.
   *
   * Accepts expired tokens — the agent can still inspect its identity.
   * Expiry is enforced when calling getToken() or toAuthHeaders().
   *
   * Also resolves the agent ID from the manifest if not set.
   *
   * @throws {EnvoyError} If the data shape is invalid
   */
  loadToken(data: unknown): void {
    const parsed = tokenDataSchema.safeParse(data);
    if (!parsed.success) {
      throw new EnvoyError(
        `Invalid token data: ${parsed.error.message}`
      );
    }

    this.tokenData = {
      manifestId: parsed.data.manifestId,
      manifestJson: parsed.data.manifestJson as unknown as ManifestPayload,
      signature: parsed.data.signature,
      expiresAt: parsed.data.expiresAt,
    };

    // Resolve agent ID from persisted manifest if not set
    if (!this.agentId && this.tokenData.manifestJson.agent_id) {
      this.agentId = this.tokenData.manifestJson.agent_id;
    }
  }

  /**
   * Get the raw Bearer token (signed JWS) for use in Authorization headers.
   *
   * @throws {EnvoyNotPairedError} If not paired
   * @throws {EnvoyTokenExpiredError} If the token has expired
   */
  getToken(): string {
    if (!this.tokenData) {
      throw new EnvoyNotPairedError();
    }

    if (this.isExpired()) {
      throw new EnvoyTokenExpiredError(new Date(this.tokenData.expiresAt));
    }

    return this.tokenData.signature;
  }

  /**
   * Get the decoded manifest payload (agent identity + metadata).
   * Works even if the token is expired — useful for inspecting identity.
   *
   * @throws {EnvoyNotPairedError} If not paired
   */
  getManifest(): ManifestPayload {
    if (!this.tokenData) {
      throw new EnvoyNotPairedError();
    }

    return this.tokenData.manifestJson;
  }

  /**
   * Check whether the current token has expired.
   * Returns `true` if not paired (no token = effectively expired).
   */
  isExpired(): boolean {
    if (!this.tokenData) {
      return true;
    }

    return new Date(this.tokenData.expiresAt) < new Date();
  }

  /**
   * Check whether the agent has been paired (has token data).
   */
  isPaired(): boolean {
    return this.tokenData !== null;
  }

  /**
   * Get the scopes granted to this agent identity.
   *
   * @throws {EnvoyNotPairedError} If not paired
   */
  getScopes(): string[] {
    if (!this.tokenData) {
      throw new EnvoyNotPairedError();
    }

    return this.tokenData.manifestJson.scopes ?? [];
  }

  /**
   * Get the agent ID. Returns the ID from the constructor if provided,
   * or the ID resolved from the manifest after pairing/loadToken.
   * Returns null if neither is available (not paired and no ID set).
   */
  getAgentId(): string | null {
    return this.agentId;
  }

  /**
   * Build an Authorization header object for use with fetch/axios/etc.
   *
   * @throws {EnvoyNotPairedError} If not paired
   * @throws {EnvoyTokenExpiredError} If the token has expired
   */
  toAuthHeaders(): { Authorization: string } {
    return { Authorization: `Bearer ${this.getToken()}` };
  }

  /**
   * Get the full token data object (for persistence or inspection).
   *
   * @throws {EnvoyNotPairedError} If not paired
   */
  getTokenData(): TokenData {
    if (!this.tokenData) {
      throw new EnvoyNotPairedError();
    }

    return this.tokenData;
  }
}
