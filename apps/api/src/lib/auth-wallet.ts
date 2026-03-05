import { jwtVerify, SignJWT } from "jose";
import type { AuthProvider, AuthVerifyResult } from "./auth-provider";

const SESSION_SECRET_RAW = process.env.ENVOY_SESSION_SECRET ?? "";
const SESSION_SECRET = new TextEncoder().encode(SESSION_SECRET_RAW);
const SESSION_TTL = Number(process.env.TOKEN_DEFAULT_TTL) || 3600; // 1 hour default

/**
 * Wallet auth provider.
 *
 * Verifies Envoy-issued session JWTs (HS256) that are created after
 * a successful Solana wallet challenge-response flow.
 */
export class WalletAuthProvider implements AuthProvider {
  async verifyToken(token: string): Promise<AuthVerifyResult> {
    if (!SESSION_SECRET_RAW) {
      throw new Error("ENVOY_SESSION_SECRET is required for wallet auth");
    }

    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      algorithms: ["HS256"],
    });

    if (!payload.sub) {
      throw new Error("JWT missing sub claim");
    }

    return {
      identifier: payload.sub,
      provider: "wallet",
      email: (payload.email as string) ?? null,
    };
  }

  /**
   * Issue a short-lived session JWT after successful signature verification.
   */
  async issueSessionToken(walletAddress: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    if (!SESSION_SECRET_RAW) {
      throw new Error("ENVOY_SESSION_SECRET is required for wallet auth");
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(walletAddress)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(SESSION_SECRET);

    return { token, expiresAt };
  }
}
