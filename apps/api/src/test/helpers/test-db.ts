/**
 * Test database helpers.
 *
 * Since setup.ts sets DATABASE_URL to the test DB before any imports,
 * the real @envoy/db module connects to the test database automatically.
 * We import from @envoy/db directly for seeding and cleaning.
 */
import { db, users } from "@envoy/db";
import { sql } from "drizzle-orm";

/**
 * Truncate all tables in correct order (respecting foreign keys).
 * Call in beforeEach to ensure test isolation.
 */
export async function cleanDb(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      webhook_subscriptions,
      platform_api_keys,
      revocations,
      audit_logs,
      pairings,
      manifests,
      agents,
      platforms,
      users
    CASCADE
  `);
}

/**
 * Seed a test user and return the user record.
 */
export async function seedUser(
  privyUserId = "did:privy:test-user-123"
): Promise<{ userId: string; privyUserId: string }> {
  const [user] = await db
    .insert(users)
    .values({ privyUserId, email: "test@envoy.dev" })
    .onConflictDoUpdate({
      target: users.privyUserId,
      set: { updatedAt: new Date() },
    })
    .returning();

  if (!user) throw new Error("Failed to seed test user");

  return { userId: user.id, privyUserId: user.privyUserId };
}
