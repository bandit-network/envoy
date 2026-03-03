import { db, agents, manifests, revocations } from "@envoy/db";
import { eq, and, isNull } from "drizzle-orm";
import type { ManifestPayload } from "@envoy/types";
import { signManifest } from "../lib/issuer";
import { logAudit } from "./audit";
import { deliverWebhook } from "./webhook";

const DEFAULT_TTL = Number(process.env.TOKEN_DEFAULT_TTL) || 3600;
const MAX_TTL = Number(process.env.TOKEN_MAX_TTL) || 86400;

interface IssueManifestResult {
  manifestId: string;
  manifestJson: ManifestPayload;
  signature: string;
  expiresAt: Date;
}

/**
 * Issue a signed manifest for an agent.
 * Verifies agent ownership and active status before signing.
 */
export async function issueManifest(
  agentId: string,
  userId: string,
  ttl?: number
): Promise<IssueManifestResult> {
  // Clamp TTL
  const effectiveTtl = Math.min(ttl ?? DEFAULT_TTL, MAX_TTL);

  // Fetch agent and verify ownership
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.ownerId, userId)),
  });

  if (!agent) {
    throw new Error("Agent not found or not owned by user");
  }

  if (agent.status !== "active") {
    throw new Error(`Cannot issue manifest for agent with status: ${agent.status}`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + effectiveTtl * 1000);

  // Build manifest payload
  const payload: ManifestPayload = {
    agent_name: agent.name,
    agent_username: agent.username ?? null,
    agent_id: agent.id,
    owner_ref: userId,
    wallet_addresses: agent.walletAddress ? [agent.walletAddress] : [],
    scopes: (agent.scopes as string[]) ?? ["api_access"],
    policy_refs: {},
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // Sign the manifest
  const signature = await signManifest(payload);

  // Store in DB
  const [manifest] = await db
    .insert(manifests)
    .values({
      agentId,
      manifestJson: payload,
      signature,
      issuedAt: now,
      expiresAt,
    })
    .returning();

  if (!manifest) {
    throw new Error("Failed to store manifest");
  }

  logAudit({
    action: "manifest_issued",
    userId,
    agentId,
    metadata: { manifestId: manifest.id, expiresAt: expiresAt.toISOString() },
  });

  deliverWebhook({
    type: "manifest.issued",
    data: { manifestId: manifest.id, agentId, expiresAt: expiresAt.toISOString() },
  });

  return {
    manifestId: manifest.id,
    manifestJson: payload,
    signature,
    expiresAt,
  };
}

/**
 * Revoke a specific manifest by ID.
 */
export async function revokeManifest(
  manifestId: string,
  reason: string
): Promise<void> {
  const now = new Date();

  await db
    .update(manifests)
    .set({ revokedAt: now })
    .where(and(eq(manifests.id, manifestId), isNull(manifests.revokedAt)));

  await db.insert(revocations).values({
    manifestId,
    revokedAt: now,
    reason,
  });

  logAudit({
    action: "manifest_revoked",
    metadata: { manifestId, reason },
  });

  deliverWebhook({
    type: "manifest.revoked",
    data: { manifestId, reason },
  });
}

/**
 * Refresh: revoke the current active manifest and issue a new one.
 */
export async function refreshManifest(
  agentId: string,
  userId: string,
  ttl?: number
): Promise<IssueManifestResult> {
  // Find the current active manifest
  const [activeManifest] = await db
    .select()
    .from(manifests)
    .where(and(eq(manifests.agentId, agentId), isNull(manifests.revokedAt)))
    .limit(1);

  // Revoke it if one exists
  if (activeManifest) {
    await revokeManifest(activeManifest.id, "refreshed");
  }

  // Issue a new one
  return issueManifest(agentId, userId, ttl);
}
