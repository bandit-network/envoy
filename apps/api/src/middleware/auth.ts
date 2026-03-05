import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { db, users } from "@envoy/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@envoy/types";
import { getAuthProvider } from "../lib/auth-factory";

/** Hono env type with authenticated user on context */
export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

/**
 * Auth middleware: verify session token and sync user to DB.
 *
 * Uses the configured auth provider (wallet or privy) to verify the
 * Bearer token. Upserts the user record in Postgres based on the
 * provider type — wallet users are keyed by walletAddress, privy
 * users by privyUserId.
 *
 * Sets AuthUser on the Hono context for downstream route handlers.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.slice(7);
  const provider = getAuthProvider();

  let result: Awaited<ReturnType<typeof provider.verifyToken>>;
  try {
    result = await provider.verifyToken(token);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid or expired token",
    });
  }

  // Upsert user based on auth provider
  let user: typeof users.$inferSelect | undefined;

  if (result.provider === "wallet") {
    // Wallet auth: upsert by walletAddress
    const [row] = await db
      .insert(users)
      .values({ walletAddress: result.identifier, email: result.email })
      .onConflictDoUpdate({
        target: users.walletAddress,
        set: { updatedAt: new Date() },
      })
      .returning();
    user = row;
  } else {
    // Privy auth: upsert by privyUserId
    const [row] = await db
      .insert(users)
      .values({ privyUserId: result.identifier, email: result.email })
      .onConflictDoUpdate({
        target: users.privyUserId,
        set: { updatedAt: new Date() },
      })
      .returning();
    user = row;
  }

  if (!user) {
    throw new HTTPException(500, { message: "Failed to sync user record" });
  }

  c.set("user", {
    userId: user.id,
    walletAddress: user.walletAddress ?? "",
    privyUserId: user.privyUserId ?? null,
    email: user.email ?? null,
  });

  await next();
});
