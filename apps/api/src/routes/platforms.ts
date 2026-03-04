import { Hono } from "hono";
import { db, platforms, platformApiKeys } from "@envoy/db";
import {
  createPlatformSchema,
  updatePlatformSchema,
  registerApiKeySchema,
} from "@envoy/types";
import { eq, and, desc, isNull, count } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { generateApiKey } from "../services/platform";

export const platformsRouter = new Hono<AuthEnv>();

/**
 * POST / -- Register a new platform
 */
platformsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPlatformSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const user = c.get("user");
  const { name, domain, webhookUrl, requireOnchainIdentity } = parsed.data;

  const [platform] = await db
    .insert(platforms)
    .values({
      ownerId: user.userId,
      name,
      domain,
      webhookUrl: webhookUrl ?? null,
      requireOnchainIdentity: requireOnchainIdentity ?? false,
    })
    .returning();

  if (!platform) {
    throw new HTTPException(500, { message: "Failed to create platform" });
  }

  logAudit({
    action: "platform_registered",
    userId: user.userId,
    metadata: { platformId: platform.id, name, domain },
  });

  return c.json({ success: true, data: platform }, 201);
});

/**
 * GET / -- List platforms owned by the authenticated user
 */
platformsRouter.get("/", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const where = and(eq(platforms.ownerId, user.userId), isNull(platforms.revokedAt));

  const [platformList, [totalRow]] = await Promise.all([
    db
      .select()
      .from(platforms)
      .where(where)
      .orderBy(desc(platforms.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(platforms).where(where),
  ]);

  return c.json({
    success: true,
    data: {
      platforms: platformList,
      total: totalRow?.total ?? 0,
      limit,
      offset,
    },
  });
});

/**
 * GET /:id -- Get a single platform
 */
platformsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const platformId = c.req.param("id");

  const platform = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), eq(platforms.ownerId, user.userId)),
  });

  if (!platform) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Platform not found" } },
      404
    );
  }

  // Get API key count
  const [keyCountRow] = await db
    .select({ total: count() })
    .from(platformApiKeys)
    .where(and(eq(platformApiKeys.platformId, platformId), isNull(platformApiKeys.revokedAt)));

  return c.json({
    success: true,
    data: {
      platform,
      apiKeyCount: keyCountRow?.total ?? 0,
    },
  });
});

/**
 * PATCH /:id -- Update platform metadata
 */
platformsRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const platformId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updatePlatformSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const existing = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), eq(platforms.ownerId, user.userId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Platform not found" } },
      404
    );
  }

  if (existing.revokedAt) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Cannot update a revoked platform" } },
      400
    );
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.domain !== undefined) updateData.domain = parsed.data.domain;
  if (parsed.data.webhookUrl !== undefined) updateData.webhookUrl = parsed.data.webhookUrl;
  if (parsed.data.requireOnchainIdentity !== undefined) updateData.requireOnchainIdentity = parsed.data.requireOnchainIdentity;

  const [updated] = await db
    .update(platforms)
    .set(updateData)
    .where(eq(platforms.id, platformId))
    .returning();

  logAudit({
    action: "platform_updated",
    userId: user.userId,
    metadata: { platformId, changes: parsed.data },
  });

  return c.json({ success: true, data: updated });
});

/**
 * DELETE /:id -- Soft-revoke platform
 */
platformsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const platformId = c.req.param("id");

  const existing = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), eq(platforms.ownerId, user.userId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Platform not found" } },
      404
    );
  }

  if (existing.revokedAt) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Platform is already revoked" } },
      400
    );
  }

  const now = new Date();

  // Revoke platform
  const [revoked] = await db
    .update(platforms)
    .set({ revokedAt: now })
    .where(eq(platforms.id, platformId))
    .returning();

  // Revoke all active API keys
  await db
    .update(platformApiKeys)
    .set({ revokedAt: now })
    .where(
      and(
        eq(platformApiKeys.platformId, platformId),
        isNull(platformApiKeys.revokedAt)
      )
    );

  logAudit({
    action: "platform_revoked",
    userId: user.userId,
    metadata: { platformId },
  });

  return c.json({ success: true, data: revoked });
});

/**
 * POST /:id/api-keys -- Generate a new API key for the platform
 */
platformsRouter.post("/:id/api-keys", async (c) => {
  const user = c.get("user");
  const platformId = c.req.param("id");

  // Verify ownership
  const platform = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), eq(platforms.ownerId, user.userId)),
  });

  if (!platform) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Platform not found" } },
      404
    );
  }

  if (platform.revokedAt) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Cannot create keys for a revoked platform" } },
      400
    );
  }

  let options: { label?: string; scopes?: string[] } = {};
  try {
    const body = await c.req.json();
    const parsed = registerApiKeySchema.safeParse(body);
    if (parsed.success) {
      options = parsed.data;
    }
  } catch {
    // Empty body is fine
  }

  try {
    const result = await generateApiKey(platformId, options);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate API key";
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message } },
      400
    );
  }
});

/**
 * GET /:id/api-keys -- List API keys for a platform (never exposes full key)
 */
platformsRouter.get("/:id/api-keys", async (c) => {
  const user = c.get("user");
  const platformId = c.req.param("id");

  // Verify ownership
  const platform = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), eq(platforms.ownerId, user.userId)),
  });

  if (!platform) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Platform not found" } },
      404
    );
  }

  const keys = await db
    .select({
      id: platformApiKeys.id,
      keyPrefix: platformApiKeys.keyPrefix,
      label: platformApiKeys.label,
      scopes: platformApiKeys.scopes,
      revokedAt: platformApiKeys.revokedAt,
      createdAt: platformApiKeys.createdAt,
    })
    .from(platformApiKeys)
    .where(eq(platformApiKeys.platformId, platformId))
    .orderBy(desc(platformApiKeys.createdAt));

  return c.json({ success: true, data: { keys } });
});

/**
 * DELETE /:id/api-keys/:keyId -- Revoke an API key
 */
platformsRouter.delete("/:id/api-keys/:keyId", async (c) => {
  const user = c.get("user");
  const platformId = c.req.param("id");
  const keyId = c.req.param("keyId");

  // Verify ownership
  const platform = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), eq(platforms.ownerId, user.userId)),
  });

  if (!platform) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Platform not found" } },
      404
    );
  }

  const [apiKey] = await db
    .select()
    .from(platformApiKeys)
    .where(
      and(
        eq(platformApiKeys.id, keyId),
        eq(platformApiKeys.platformId, platformId)
      )
    )
    .limit(1);

  if (!apiKey) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "API key not found" } },
      404
    );
  }

  if (apiKey.revokedAt) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "API key is already revoked" } },
      400
    );
  }

  const [revoked] = await db
    .update(platformApiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(platformApiKeys.id, keyId))
    .returning({
      id: platformApiKeys.id,
      keyPrefix: platformApiKeys.keyPrefix,
      revokedAt: platformApiKeys.revokedAt,
    });

  logAudit({
    action: "api_key_revoked",
    userId: user.userId,
    metadata: { platformId, keyId, keyPrefix: apiKey.keyPrefix },
  });

  return c.json({ success: true, data: revoked });
});
