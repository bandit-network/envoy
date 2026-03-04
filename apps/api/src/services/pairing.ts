import { randomBytes } from "crypto";
import { hash, verify } from "@node-rs/argon2";
import { db, agents, pairings } from "@envoy/db";
import { eq, and } from "drizzle-orm";
import { logAudit } from "./audit";
import { issueManifest } from "./manifest";

const PAIRING_SECRET_TTL = Number(process.env.PAIRING_SECRET_TTL) || 600;

interface CreatePairingResult {
  pairingId: string;
  pairingSecret: string;
  expiresAt: Date;
}

/**
 * Generate a pairing secret for an agent.
 * The plaintext secret is returned exactly once; only the hash is stored.
 */
export async function createPairing(
  agentId: string,
  userId: string
): Promise<CreatePairingResult> {
  // Verify agent ownership and active status
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.ownerId, userId)),
  });

  if (!agent) {
    throw new Error("Agent not found or not owned by user");
  }

  if (agent.status !== "active") {
    throw new Error(`Cannot create pairing for agent with status: ${agent.status}`);
  }

  // Generate 32-byte random secret, encode as hex
  const secret = randomBytes(32).toString("hex");

  // Hash with argon2
  const secretHash = await hash(secret);

  const expiresAt = new Date(Date.now() + PAIRING_SECRET_TTL * 1000);

  const [pairing] = await db
    .insert(pairings)
    .values({
      agentId,
      secretHash,
      expiresAt,
      used: false,
    })
    .returning();

  if (!pairing) {
    throw new Error("Failed to create pairing");
  }

  logAudit({
    action: "pairing_created",
    userId,
    agentId,
    metadata: { pairingId: pairing.id },
  });

  return {
    pairingId: pairing.id,
    pairingSecret: secret,
    expiresAt,
  };
}

interface ConfirmPairingResult {
  manifestId: string;
  manifestJson: Record<string, unknown>;
  signature: string;
  expiresAt: Date;
}

/**
 * Confirm a pairing by verifying the secret.
 * Called by agent runtimes (no auth required).
 * On success, issues a manifest and returns it.
 */
export async function confirmPairing(
  agentId: string,
  pairingId: string,
  secret: string
): Promise<ConfirmPairingResult> {
  // Fetch the pairing record
  const pairing = await db.query.pairings.findFirst({
    where: and(eq(pairings.id, pairingId), eq(pairings.agentId, agentId)),
  });

  if (!pairing) {
    throw new Error("Pairing not found");
  }

  if (pairing.used) {
    throw new Error("Pairing secret has already been used");
  }

  if (pairing.expiresAt < new Date()) {
    throw new Error("Pairing secret has expired");
  }

  // Verify the secret against the stored hash
  const valid = await verify(pairing.secretHash, secret);
  if (!valid) {
    throw new Error("Invalid pairing secret");
  }

  // Mark as used
  const now = new Date();
  await db
    .update(pairings)
    .set({ used: true, pairedAt: now })
    .where(eq(pairings.id, pairingId));

  // Get the agent's owner to issue the manifest
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  // Issue a manifest for the agent
  const result = await issueManifest(agentId, agent.ownerId);

  logAudit({
    action: "pairing_confirmed",
    agentId,
    metadata: { pairingId, manifestId: result.manifestId },
  });

  return {
    manifestId: result.manifestId,
    manifestJson: result.manifestJson as unknown as Record<string, unknown>,
    signature: result.signature,
    expiresAt: result.expiresAt,
  };
}

/**
 * Confirm a pairing using only pairingId + secret — no agent ID needed.
 * Resolves the agent from the pairing record automatically.
 * This is the preferred flow for agent runtimes: the human provides
 * just the pairing ID and secret, and the agent figures out the rest.
 */
export async function confirmPairingDirect(
  pairingId: string,
  secret: string
): Promise<ConfirmPairingResult> {
  // Look up the pairing to discover the agent ID
  const pairing = await db.query.pairings.findFirst({
    where: eq(pairings.id, pairingId),
  });

  if (!pairing) {
    throw new Error("Pairing not found");
  }

  if (pairing.used) {
    throw new Error("Pairing secret has already been used");
  }

  if (pairing.expiresAt < new Date()) {
    throw new Error("Pairing secret has expired");
  }

  // Verify the secret against the stored hash
  const valid = await verify(pairing.secretHash, secret);
  if (!valid) {
    throw new Error("Invalid pairing secret");
  }

  // Mark as used
  const now = new Date();
  await db
    .update(pairings)
    .set({ used: true, pairedAt: now })
    .where(eq(pairings.id, pairingId));

  // Get the agent's owner to issue the manifest
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, pairing.agentId),
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  // Issue a manifest for the agent
  const result = await issueManifest(pairing.agentId, agent.ownerId);

  logAudit({
    action: "pairing_confirmed",
    agentId: pairing.agentId,
    metadata: { pairingId, manifestId: result.manifestId },
  });

  return {
    manifestId: result.manifestId,
    manifestJson: result.manifestJson as unknown as Record<string, unknown>,
    signature: result.signature,
    expiresAt: result.expiresAt,
  };
}
