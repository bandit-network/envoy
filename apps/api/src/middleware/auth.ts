import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { db, users } from "@envoy/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@envoy/types";
import { privyClient } from "../lib/privy";

/** Hono env type with authenticated user on context */
export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

/**
 * Auth middleware: verify Privy JWT and sync user to DB.
 *
 * Extracts Bearer token from Authorization header, verifies with
 * Privy server SDK, then upserts the user record in Postgres.
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

  let verifiedClaims: { userId: string };
  try {
    verifiedClaims = await privyClient.verifyAuthToken(token);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid or expired token",
    });
  }

  const privyUserId = verifiedClaims.userId;

  // Atomic upsert: create on first visit, touch updatedAt on return
  const [user] = await db
    .insert(users)
    .values({ privyUserId, email: null })
    .onConflictDoUpdate({
      target: users.privyUserId,
      set: { updatedAt: new Date() },
    })
    .returning();

  if (!user) {
    throw new HTTPException(500, { message: "Failed to sync user record" });
  }

  c.set("user", {
    userId: user.id,
    privyUserId: user.privyUserId,
    email: user.email,
  });

  await next();
});
