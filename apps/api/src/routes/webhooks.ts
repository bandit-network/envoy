import { Hono } from "hono";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { db, webhookSubscriptions, platforms } from "@envoy/db";
import { eq, and } from "drizzle-orm";
import type { AuthEnv } from "../middleware/auth";

export const webhooksRouter = new Hono<AuthEnv>();

const VALID_EVENT_TYPES = [
  "manifest.revoked",
  "agent.revoked",
  "manifest.issued",
  "manifest.expiring",
] as const;

const subscribeSchema = z.object({
  platformId: z.string().uuid(),
  url: z.string().url(),
  eventTypes: z
    .array(z.enum(VALID_EVENT_TYPES))
    .min(1, "At least one event type is required"),
});

/**
 * POST /subscribe -- Create a webhook subscription for a platform.
 * Returns the signing secret exactly once.
 */
webhooksRouter.post("/subscribe", async (c) => {
  const body = await c.req.json();
  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: parsed.error.message },
      },
      400
    );
  }

  const user = c.get("user");
  const { platformId, url, eventTypes } = parsed.data;

  // Verify platform ownership
  const platform = await db.query.platforms.findFirst({
    where: and(
      eq(platforms.id, platformId),
      eq(platforms.ownerId, user.userId)
    ),
  });

  if (!platform) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Platform not found" },
      },
      404
    );
  }

  // Generate signing secret
  const signingSecret = `whsec_${randomBytes(24).toString("hex")}`;
  const secretHash = createHash("sha256").update(signingSecret).digest("hex");

  const [subscription] = await db
    .insert(webhookSubscriptions)
    .values({
      platformId,
      url,
      eventTypes,
      secretHash,
    })
    .returning();

  if (!subscription) {
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL", message: "Failed to create subscription" },
      },
      500
    );
  }

  return c.json(
    {
      success: true,
      data: {
        id: subscription.id,
        url: subscription.url,
        eventTypes: subscription.eventTypes,
        signingSecret, // Returned ONCE
        createdAt: subscription.createdAt,
      },
    },
    201
  );
});

/**
 * GET / -- List webhook subscriptions for user's platforms.
 */
webhooksRouter.get("/", async (c) => {
  const user = c.get("user");

  // Get all platforms owned by user
  const userPlatforms = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.ownerId, user.userId));

  if (userPlatforms.length === 0) {
    return c.json({
      success: true,
      data: { subscriptions: [] },
    });
  }

  const platformIds = userPlatforms.map((p) => p.id);

  const allSubs = await db.select().from(webhookSubscriptions);
  const userSubs = allSubs.filter((s) => platformIds.includes(s.platformId));

  return c.json({
    success: true,
    data: {
      subscriptions: userSubs.map((s) => ({
        id: s.id,
        platformId: s.platformId,
        url: s.url,
        eventTypes: s.eventTypes,
        createdAt: s.createdAt,
      })),
    },
  });
});

/**
 * DELETE /:id -- Delete a webhook subscription.
 */
webhooksRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const subscriptionId = c.req.param("id");

  // Find the subscription
  const sub = await db.query.webhookSubscriptions.findFirst({
    where: eq(webhookSubscriptions.id, subscriptionId),
  });

  if (!sub) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Subscription not found" },
      },
      404
    );
  }

  // Verify platform ownership
  const platform = await db.query.platforms.findFirst({
    where: and(
      eq(platforms.id, sub.platformId),
      eq(platforms.ownerId, user.userId)
    ),
  });

  if (!platform) {
    return c.json(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      },
      403
    );
  }

  await db
    .delete(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, subscriptionId));

  return c.json({ success: true, data: { deleted: true } });
});
