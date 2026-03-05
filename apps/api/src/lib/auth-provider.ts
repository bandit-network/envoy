/**
 * Auth provider abstraction.
 *
 * Allows the auth middleware to verify tokens regardless of provider
 * (Solana wallet adapter, Privy, magic links, etc.).
 *
 * Configure via AUTH_PROVIDER env var: "wallet" (default) | "privy"
 */

export interface AuthVerifyResult {
  /** Unique identifier: walletAddress for wallet provider, privyUserId for privy */
  identifier: string;
  /** Which auth provider verified this token */
  provider: "wallet" | "privy";
  /** Email if available from the auth provider */
  email: string | null;
}

export interface AuthProvider {
  /** Verify a Bearer token and return the authenticated user identifier */
  verifyToken(token: string): Promise<AuthVerifyResult>;
}
