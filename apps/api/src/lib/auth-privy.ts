import type { AuthProvider, AuthVerifyResult } from "./auth-provider";

/**
 * Privy auth provider (optional fallback).
 *
 * Wraps the existing Privy server SDK verification behind the
 * AuthProvider interface. Only used when AUTH_PROVIDER=privy.
 */
export class PrivyAuthProvider implements AuthProvider {
  async verifyToken(token: string): Promise<AuthVerifyResult> {
    // Lazy import to avoid requiring Privy env vars when not in use
    const { getPrivyClient } = await import("./privy");
    const client = getPrivyClient();

    const claims = await client.verifyAuthToken(token);

    return {
      identifier: claims.userId,
      provider: "privy",
      email: null,
    };
  }
}
