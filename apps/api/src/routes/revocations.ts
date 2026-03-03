import { Hono } from "hono";
import { db, manifests, revocations } from "@envoy/db";
import { eq, and } from "drizzle-orm";

export const revocationsRouter = new Hono();

/**
 * GET /api/v1/revocations/:id
 * Public endpoint. Check if a specific manifest has been revoked.
 */
revocationsRouter.get("/revocations/:id", async (c) => {
  const manifestId = c.req.param("id");

  // Check if manifest exists
  const [manifest] = await db
    .select({
      id: manifests.id,
      revokedAt: manifests.revokedAt,
    })
    .from(manifests)
    .where(eq(manifests.id, manifestId))
    .limit(1);

  if (!manifest) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Manifest not found" } },
      404
    );
  }

  // Get revocation record if exists
  const [revocation] = await db
    .select({
      revokedAt: revocations.revokedAt,
      reason: revocations.reason,
    })
    .from(revocations)
    .where(eq(revocations.manifestId, manifestId))
    .limit(1);

  return c.json({
    success: true,
    data: {
      revoked: !!manifest.revokedAt,
      revokedAt: revocation?.revokedAt ?? manifest.revokedAt ?? null,
      reason: revocation?.reason ?? null,
    },
  });
});
