import { z } from "zod";

/** Shape of the authenticated user context attached to API requests */
export interface AuthUser {
  /** Envoy internal user ID (UUID) */
  userId: string;
  /** Solana wallet public key (base58) — primary identifier */
  walletAddress: string;
  /** @deprecated Privy user ID, kept for backward compat. Null for wallet-auth users. */
  privyUserId: string | null;
  /** Email if available */
  email: string | null;
}

// ---------------------------------------------------------------------------
// Challenge-response auth schemas
// ---------------------------------------------------------------------------

/** Request a nonce to sign */
export const authChallengeRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});
export type AuthChallengeRequest = z.infer<typeof authChallengeRequestSchema>;

/** Response with a nonce */
export interface AuthChallengeResponse {
  nonce: string;
  expiresAt: string; // ISO datetime, 5 min TTL
  message: string; // Human-readable signing message
}

/** Submit signed challenge */
export const authVerifyRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string().min(1), // base58-encoded Ed25519 signature
  nonce: z.string().min(1),
});
export type AuthVerifyRequest = z.infer<typeof authVerifyRequestSchema>;

/** JWT session response */
export interface AuthSessionResponse {
  token: string; // Envoy-issued JWT (1hr)
  expiresAt: string; // ISO datetime
  user: AuthUser;
}
