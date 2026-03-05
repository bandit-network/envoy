import { Hono } from "hono";
import { randomBytes } from "crypto";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { db, users } from "@envoy/db";
import { eq } from "drizzle-orm";
import {
  authChallengeRequestSchema,
  authVerifyRequestSchema,
} from "@envoy/types";
import { ensureRedis } from "../lib/redis";
import { WalletAuthProvider } from "../lib/auth-wallet";

const NONCE_TTL = 300; // 5 minutes
const NONCE_PREFIX = "auth:nonce:";

const walletAuth = new WalletAuthProvider();

export const authRouter = new Hono();

/**
 * POST /auth/challenge
 *
 * Request a nonce for wallet signature authentication.
 * Generates a 32-byte random nonce, stores it in Redis with a 5-minute TTL,
 * and returns a human-readable message for the wallet to sign.
 */
authRouter.post("/auth/challenge", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Invalid JSON body" },
      },
      400
    );
  }

  const parsed = authChallengeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: parsed.error.message },
      },
      400
    );
  }

  const { walletAddress } = parsed.data;

  // Validate that walletAddress is a valid Solana public key
  try {
    new PublicKey(walletAddress);
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid Solana wallet address",
        },
      },
      400
    );
  }

  // Generate nonce
  const nonce = randomBytes(32).toString("hex");
  const timestamp = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL * 1000).toISOString();

  // Build human-readable message
  const message = [
    "Sign this message to authenticate with Envoy.",
    "",
    `Nonce: ${nonce}`,
    `Wallet: ${walletAddress}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");

  // Store nonce in Redis with TTL
  const redis = await ensureRedis();
  await redis.set(
    `${NONCE_PREFIX}${walletAddress}`,
    JSON.stringify({ nonce, message, timestamp }),
    "EX",
    NONCE_TTL
  );

  return c.json({
    success: true,
    data: { nonce, message, expiresAt },
  });
});

/**
 * POST /auth/verify
 *
 * Submit a signed nonce to complete authentication.
 * Verifies the Ed25519 signature, deletes the nonce (single-use),
 * upserts the user record, and issues a session JWT.
 */
authRouter.post("/auth/verify", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Invalid JSON body" },
      },
      400
    );
  }

  const parsed = authVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: parsed.error.message },
      },
      400
    );
  }

  const { walletAddress, signature, nonce } = parsed.data;

  // Validate wallet address
  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(walletAddress);
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid Solana wallet address",
        },
      },
      400
    );
  }

  // Retrieve nonce from Redis
  const redis = await ensureRedis();
  const storedRaw = await redis.get(`${NONCE_PREFIX}${walletAddress}`);

  if (!storedRaw) {
    return c.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Nonce expired or not found. Request a new challenge.",
        },
      },
      401
    );
  }

  const stored = JSON.parse(storedRaw) as {
    nonce: string;
    message: string;
    timestamp: string;
  };

  // Verify nonce matches
  if (stored.nonce !== nonce) {
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Nonce mismatch" },
      },
      401
    );
  }

  // Verify Ed25519 signature
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = bs58.decode(signature);
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid signature encoding (expected base58)",
        },
      },
      400
    );
  }

  const messageBytes = new TextEncoder().encode(stored.message);

  const verified = nacl.sign.detached.verify(
    messageBytes,
    signatureBytes,
    publicKey.toBytes()
  );

  if (!verified) {
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Signature verification failed" },
      },
      401
    );
  }

  // Delete nonce from Redis (single-use)
  await redis.del(`${NONCE_PREFIX}${walletAddress}`);

  // Upsert user by walletAddress
  const [user] = await db
    .insert(users)
    .values({ walletAddress, email: null })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { updatedAt: new Date() },
    })
    .returning();

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL", message: "Failed to sync user record" },
      },
      500
    );
  }

  // Issue session JWT
  const { token, expiresAt } = await walletAuth.issueSessionToken(walletAddress);

  return c.json({
    success: true,
    data: {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        userId: user.id,
        walletAddress: user.walletAddress ?? walletAddress,
        privyUserId: user.privyUserId ?? null,
        email: user.email ?? null,
      },
    },
  });
});
