import { z } from "zod";

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

export interface EnvoyAgentOptions {
  /** Base URL of the Envoy API (e.g. "https://api.useenvoy.dev") */
  envoyUrl: string;

  /** The agent's UUID as registered on Envoy */
  agentId: string;

  /** Optional custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch;

  /**
   * Callback invoked after a successful `pair()` call.
   * Use this to persist the token data to disk, database, or env.
   */
  onTokenReceived?: (data: TokenData) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Manifest payload — self-contained copy matching the API schema.
// Defined locally so the SDK is publishable standalone without @envoy/types.
// ---------------------------------------------------------------------------

export interface ManifestPayload {
  agent_name: string;
  agent_username: string | null;
  agent_id: string;
  owner_ref: string;
  wallet_addresses: string[];
  scopes: string[];
  policy_refs: {
    envoy_policy_url?: string;
    privy_policy_url?: string;
  };
  issued_at: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Token data — JSON-serializable structure for persistence
// ---------------------------------------------------------------------------

export interface TokenData {
  /** UUID of the manifest */
  manifestId: string;

  /** Decoded manifest payload (agent identity + metadata) */
  manifestJson: ManifestPayload;

  /** Signed JWS token — used as Bearer token */
  signature: string;

  /** ISO-8601 expiry timestamp */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Zod schemas for API response validation
// ---------------------------------------------------------------------------

export const pairConfirmResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    manifestId: z.string(),
    manifestJson: z.record(z.unknown()),
    signature: z.string(),
    expiresAt: z.string(),
  }),
});

export type PairConfirmResponse = z.infer<typeof pairConfirmResponseSchema>;

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

// ---------------------------------------------------------------------------
// Token data validation for loadToken
// ---------------------------------------------------------------------------

export const tokenDataSchema = z.object({
  manifestId: z.string().min(1),
  manifestJson: z.record(z.unknown()),
  signature: z.string().min(1),
  expiresAt: z.string().min(1),
});
