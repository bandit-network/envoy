import { Hono } from "hono";
import { db, agents, manifests, revocations, auditLogs, orgMembers } from "@envoy/db";
import { createAgentSchema, updateAgentSchema, issueManifestSchema } from "@envoy/types";
import { eq, and, desc, isNull, count, or, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { issueManifest, refreshManifest } from "../services/manifest";
import { createPairing } from "../services/pairing";
import { deliverWebhook } from "../services/webhook";
import { provisionWallet } from "../services/wallet";
import { registerAgentOnChain, updateAgentMetadataOnChain, createEnvoyCollection } from "../services/registry";
import { getOrgAccess } from "../lib/org-access";

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
  const { name, description, username, avatarUrl, socialMoltbook, socialX, scopes, defaultTtl, orgId } = parsed.data;

  // Validate org membership if orgId is provided
  if (orgId) {
    const access = await getOrgAccess(user.userId, orgId);
    if (!access.canWrite) {
      return c.json(
        { success: false, error: { code: "FORBIDDEN", message: "You don't have write access to this organization" } },
        403
      );
    }
  }

  let agent;
  try {
    const [inserted] = await db
      .insert(agents)
      .values({
        ownerId: user.userId,
        name,
        description: description ?? null,
        username: username ?? null,
        avatarUrl: avatarUrl ?? null,
        socialMoltbook: socialMoltbook ?? null,
        socialX: socialX ?? null,
        ...(scopes ? { scopes } : {}),
        ...(defaultTtl !== undefined ? { defaultTtl: defaultTtl ?? null } : {}),
        ...(orgId ? { orgId } : {}),
      })
      .returning();
    agent = inserted;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "23505" &&
      String(err).includes("agents_username_unique")
    ) {
      return c.json(
        { success: false, error: { code: "CONFLICT", message: "Username is already taken" } },
        409
      );
    }
    throw err;
  }

  if (!agent) {
    throw new HTTPException(500, { message: "Failed to create agent" });
  }

  // Provision wallet — no-custody: secret key shown once, never stored
  const walletResult = await provisionWallet(agent.id, user.userId);
  const walletAddress = walletResult?.publicKey ?? null;
  let agentData = walletAddress
    ? { ...agent, walletAddress }
    : agent;

  // Register on 8004 registry (async, never blocks agent creation)
  let registryAssetId: string | null = null;
  if (walletAddress) {
    registryAssetId = await registerAgentOnChain(
      agent.id,
      agent.name,
      agent.description ?? "",
      walletAddress,
      agent.avatarUrl,
      agent.username
    );
    if (registryAssetId) {
      agentData = { ...agentData, registryAssetId };
    }
  }

  // Auto-generate pairing credentials so the human can immediately
  // hand them to the agent runtime — no extra step required.
  let pairing: { pairingId: string; pairingSecret: string; expiresAt: Date } | null = null;
  try {
    pairing = await createPairing(agent.id, user.userId);
  } catch {
    // Pairing generation is best-effort — never blocks agent creation.
    // The human can always generate a new one from the agent detail page.
    console.warn("[agents] Failed to auto-generate pairing on creation");
  }

  logAudit({
    action: "agent_created",
    userId: user.userId,
    agentId: agent.id,
    metadata: { name, walletAddress, registryAssetId },
  });

  if (registryAssetId) {
    logAudit({
      action: "agent_registry_registered",
      userId: user.userId,
      agentId: agent.id,
      metadata: { registryAssetId },
    });
  }

  return c.json({
    success: true,
    data: {
      ...agentData,
      pairing: pairing ?? undefined,
      // Secret key shown ONCE at creation — never stored in DB
      walletSecretKey: walletResult?.secretKey ?? undefined,
    },
  }, 201);
});

/**
 * GET / -- List agents owned by the authenticated user
 */
agentsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  // Get org IDs the user belongs to
  const userOrgMemberships = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.userId));
  const userOrgIds = userOrgMemberships.map((m) => m.orgId);

  // Include agents owned by user OR belonging to user's orgs
  const ownershipCondition =
    userOrgIds.length > 0
      ? or(eq(agents.ownerId, user.userId), inArray(agents.orgId, userOrgIds))!
      : eq(agents.ownerId, user.userId);

  const conditions = [ownershipCondition];
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

  // Determine paired status: agent has at least one active (non-revoked) manifest
  const agentIds = agentList.map((a) => a.id);
  let pairedAgentIds: Set<string> = new Set();
  if (agentIds.length > 0) {
    const pairedRows = await db
      .selectDistinct({ agentId: manifests.agentId })
      .from(manifests)
      .where(and(inArray(manifests.agentId, agentIds), isNull(manifests.revokedAt)));
    pairedAgentIds = new Set(pairedRows.map((r) => r.agentId));
  }

  return c.json({
    success: true,
    data: {
      agents: agentList.map((a) => ({ ...a, isPaired: pairedAgentIds.has(a.id) })),
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
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  // Check access: owner or org member
  const isOwner = agent.ownerId === user.userId;
  const hasOrgAccess = agent.orgId ? (await getOrgAccess(user.userId, agent.orgId)).member : false;
  if (!isOwner && !hasOrgAccess) {
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
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
  if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.socialMoltbook !== undefined) updateData.socialMoltbook = parsed.data.socialMoltbook;
  if (parsed.data.socialX !== undefined) updateData.socialX = parsed.data.socialX;
  if (parsed.data.scopes !== undefined) updateData.scopes = parsed.data.scopes;
  if (parsed.data.defaultTtl !== undefined) updateData.defaultTtl = parsed.data.defaultTtl ?? null;
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

  let updated;
  try {
    const [result] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, agentId))
      .returning();
    updated = result;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "23505" &&
      String(err).includes("agents_username_unique")
    ) {
      return c.json(
        { success: false, error: { code: "CONFLICT", message: "Username is already taken" } },
        409
      );
    }
    throw err;
  }

  const action = parsed.data.status === "revoked" ? "agent_revoked" : "agent_updated";
  logAudit({
    action,
    userId: user.userId,
    agentId,
    metadata: { changes: parsed.data },
  });

  // Auto-sync on-chain metadata if relevant fields changed and agent is registered
  const metadataFieldsChanged = [
    "name", "description", "avatarUrl", "username",
  ].some((field) => parsed.data[field as keyof typeof parsed.data] !== undefined);

  if (updated && metadataFieldsChanged && updated.registryAssetId && updated.walletAddress) {
    // Capture narrowed values for the fire-and-forget closure
    const walletAddr = updated.walletAddress;
    const assetId = updated.registryAssetId;
    const agentData = updated;
    // Fire-and-forget — don't block the PATCH response
    updateAgentMetadataOnChain(
      agentData.id,
      agentData.name,
      agentData.description ?? "",
      walletAddr,
      assetId,
      agentData.avatarUrl,
      agentData.username
    ).then((success) => {
      if (success) {
        logAudit({
          action: "agent_registry_metadata_updated",
          userId: user.userId,
          agentId,
          metadata: { registryAssetId: assetId, trigger: "auto" },
        });
      }
    }).catch(() => {
      // Silently ignore — on-chain sync is best-effort
    });
  }

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
 * POST /:id/register -- Manually register agent on the 8004 Solana registry
 */
agentsRouter.post("/:id/register", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

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

  if (agent.status !== "active") {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent must be active to register on-chain" } },
      400
    );
  }

  if (!agent.walletAddress) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent must have a wallet address to register on-chain" } },
      400
    );
  }

  if (agent.registryAssetId) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent is already registered on-chain" } },
      400
    );
  }

  const registryAssetId = await registerAgentOnChain(
    agent.id,
    agent.name,
    agent.description ?? "",
    agent.walletAddress,
    agent.avatarUrl,
    agent.username
  );

  if (!registryAssetId) {
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to register agent on-chain. Check server logs for details." } },
      500
    );
  }

  logAudit({
    action: "agent_registry_registered",
    userId: user.userId,
    agentId: agent.id,
    metadata: { registryAssetId },
  });

  return c.json({
    success: true,
    data: { registryAssetId },
  }, 201);
});

/**
 * POST /:id/update-metadata -- Update agent's on-chain metadata on the 8004 registry
 */
agentsRouter.post("/:id/update-metadata", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

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

  if (agent.status !== "active") {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent must be active to update on-chain metadata" } },
      400
    );
  }

  if (!agent.registryAssetId) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent is not registered on-chain" } },
      400
    );
  }

  if (!agent.walletAddress) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Agent must have a wallet address" } },
      400
    );
  }

  const success = await updateAgentMetadataOnChain(
    agent.id,
    agent.name,
    agent.description ?? "",
    agent.walletAddress,
    agent.registryAssetId,
    agent.avatarUrl,
    agent.username
  );

  if (!success) {
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update on-chain metadata. Check server logs for details." } },
      500
    );
  }

  logAudit({
    action: "agent_registry_metadata_updated",
    userId: user.userId,
    agentId: agent.id,
    metadata: { registryAssetId: agent.registryAssetId },
  });

  return c.json({ success: true });
});

/**
 * POST /registry/init-collection -- Create the global Envoy collection (one-time setup)
 */
agentsRouter.post("/registry/init-collection", async (c) => {
  const user = c.get("user");

  // If collection pointer is already configured, return it
  const existingPointer = process.env.REGISTRY_COLLECTION_POINTER;
  if (existingPointer) {
    return c.json({
      success: true,
      data: {
        pointer: existingPointer,
        message: "Collection pointer is already configured. No action needed.",
      },
    });
  }

  const result = await createEnvoyCollection();

  if (!result) {
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create collection. Check server logs for details." } },
      500
    );
  }

  logAudit({
    action: "registry_collection_created",
    userId: user.userId,
    agentId: undefined,
    metadata: { pointer: result.pointer, uri: result.uri, cid: result.cid },
  });

  return c.json({
    success: true,
    data: {
      ...result,
      message: "Collection created. Add this to your .env: REGISTRY_COLLECTION_POINTER=" + result.pointer,
    },
  }, 201);
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
