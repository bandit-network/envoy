import { Hono } from "hono";
import { db, agents, manifests, revocations, auditLogs } from "@envoy/db";
import { createAgentSchema, updateAgentSchema, issueManifestSchema } from "@envoy/types";
import { eq, and, desc, isNull, count } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { issueManifest, refreshManifest } from "../services/manifest";
import { createPairing } from "../services/pairing";
import { deliverWebhook } from "../services/webhook";

export const agentsRouter = new Hono<AuthEnv>();

/**
 * POST / -- Create a new agent
 */
agentsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createAgentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const user = c.get("user");
  const { name, description } = parsed.data;

  const [agent] = await db
    .insert(agents)
    .values({
      ownerId: user.userId,
      name,
      description: description ?? null,
    })
    .returning();

  if (!agent) {
    throw new HTTPException(500, { message: "Failed to create agent" });
  }

  logAudit({
    action: "agent_created",
    userId: user.userId,
    agentId: agent.id,
    metadata: { name },
  });

  return c.json({ success: true, data: agent }, 201);
});

/**
 * GET / -- List agents owned by the authenticated user
 */
agentsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const conditions = [eq(agents.ownerId, user.userId)];
  if (status && ["active", "suspended", "revoked"].includes(status)) {
    conditions.push(eq(agents.status, status as "active" | "suspended" | "revoked"));
  }

  const where = and(...conditions);

  const [agentList, [totalRow]] = await Promise.all([
    db
      .select()
      .from(agents)
      .where(where)
      .orderBy(desc(agents.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(agents)
      .where(where),
  ]);

  return c.json({
    success: true,
    data: {
      agents: agentList,
      total: totalRow?.total ?? 0,
      limit,
      offset,
    },
  });
});

/**
 * GET /:id -- Get a single agent with its latest active manifest
 */
agentsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.ownerId, user.userId)),
  });

  if (!agent) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  // Get the latest non-revoked manifest
  const [latestManifest] = await db
    .select()
    .from(manifests)
    .where(and(eq(manifests.agentId, agentId), isNull(manifests.revokedAt)))
    .orderBy(desc(manifests.issuedAt))
    .limit(1);

  return c.json({
    success: true,
    data: {
      agent,
      manifest: latestManifest ?? null,
    },
  });
});

/**
 * PATCH /:id -- Update agent metadata or status
 */
agentsRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  // Verify ownership
  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.ownerId, user.userId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  if (existing.status === "revoked" && parsed.data.status !== "active") {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Cannot update a revoked agent unless reactivating" } },
      400
    );
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  // If revoking via PATCH
  if (parsed.data.status === "revoked") {
    updateData.revokedAt = new Date();
    await revokeAgentManifests(agentId, "status_change");
  }

  // If reactivating, clear revokedAt
  if (parsed.data.status === "active" && existing.status === "revoked") {
    updateData.revokedAt = null;
  }

  const [updated] = await db
    .update(agents)
    .set(updateData)
    .where(eq(agents.id, agentId))
    .returning();

  const action = parsed.data.status === "revoked" ? "agent_revoked" : "agent_updated";
  logAudit({
    action,
    userId: user.userId,
    agentId,
    metadata: { changes: parsed.data },
  });

  return c.json({ success: true, data: updated });
});

/**
 * DELETE /:id -- Revoke agent (soft delete)
 */
agentsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.ownerId, user.userId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  if (existing.status === "revoked") {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent is already revoked" } },
      400
    );
  }

  const now = new Date();

  const [revoked] = await db
    .update(agents)
    .set({ status: "revoked", revokedAt: now })
    .where(eq(agents.id, agentId))
    .returning();

  await revokeAgentManifests(agentId, "agent_revoked");

  logAudit({
    action: "agent_revoked",
    userId: user.userId,
    agentId,
    metadata: { reason: "agent_revoked" },
  });

  deliverWebhook({
    type: "agent.revoked",
    data: { agentId, agentName: existing.name },
  });

  return c.json({ success: true, data: revoked });
});

/**
 * POST /:id/manifest -- Issue a new signed manifest
 */
agentsRouter.post("/:id/manifest", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

  let ttl: number | undefined;
  try {
    const body = await c.req.json();
    const parsed = issueManifestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400
      );
    }
    ttl = parsed.data.ttl;
  } catch {
    // Empty body is fine, use default TTL
  }

  try {
    const result = await issueManifest(agentId, user.userId, ttl);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to issue manifest";
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message } },
      400
    );
  }
});

/**
 * POST /:id/refresh -- Revoke current manifest and issue a new one
 */
agentsRouter.post("/:id/refresh", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

  let ttl: number | undefined;
  try {
    const body = await c.req.json();
    const parsed = issueManifestSchema.safeParse(body);
    if (parsed.success) ttl = parsed.data.ttl;
  } catch {
    // Empty body is fine
  }

  try {
    const result = await refreshManifest(agentId, user.userId, ttl);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh manifest";
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message } },
      400
    );
  }
});

/**
 * POST /:id/pair -- Generate a pairing secret (auth required, human operator)
 */
agentsRouter.post("/:id/pair", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

  try {
    const result = await createPairing(agentId, user.userId);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create pairing";
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message } },
      400
    );
  }
});

/**
 * GET /:id/audit -- Get audit log for an agent
 */
agentsRouter.get("/:id/audit", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  // Verify ownership
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.ownerId, user.userId)),
  });

  if (!agent) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  const [entries, [totalRow]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.agentId, agentId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(eq(auditLogs.agentId, agentId)),
  ]);

  return c.json({
    success: true,
    data: {
      entries,
      total: totalRow?.total ?? 0,
      limit,
      offset,
    },
  });
});

/**
 * Helper: revoke all active manifests for an agent
 */
async function revokeAgentManifests(agentId: string, reason: string): Promise<void> {
  const now = new Date();

  // Find all active (non-revoked) manifests
  const activeManifests = await db
    .select({ id: manifests.id })
    .from(manifests)
    .where(and(eq(manifests.agentId, agentId), isNull(manifests.revokedAt)));

  if (activeManifests.length === 0) return;

  // Mark them revoked
  await db
    .update(manifests)
    .set({ revokedAt: now })
    .where(and(eq(manifests.agentId, agentId), isNull(manifests.revokedAt)));

  // Insert revocation records
  const revocationValues = activeManifests.map((m) => ({
    manifestId: m.id,
    revokedAt: now,
    reason,
  }));

  await db.insert(revocations).values(revocationValues);
}
