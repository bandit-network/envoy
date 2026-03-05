import { Hono } from "hono";
import { db, agents } from "@envoy/db";
import { eq, and } from "drizzle-orm";
import type { AuthEnv } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { prepareRegistrationTx, confirmRegistration } from "../services/registry";

export const registerRouter = new Hono<AuthEnv>();

/**
 * POST /agents/:id/register-prepare
 *
 * Human-pays model: server uploads metadata to IPFS and builds the
 * transaction, human's wallet signs and pays the SOL fee.
 */
registerRouter.post("/agents/:id/register-prepare", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("id");

  try {
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
        { success: false, error: { code: "BAD_REQUEST", message: "Agent must have a wallet address" } },
        400
      );
    }

    if (agent.registryAssetId) {
      return c.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Agent is already registered on-chain" } },
        400
      );
    }

    const body = await c.req.json<{ humanWalletAddress: string }>().catch(() => ({ humanWalletAddress: "" }));
    if (!body.humanWalletAddress) {
      return c.json(
        { success: false, error: { code: "BAD_REQUEST", message: "humanWalletAddress is required" } },
        400
      );
    }

    const prepared = await prepareRegistrationTx(
      agent.id,
      agent.name,
      agent.description ?? "",
      agent.walletAddress,
      body.humanWalletAddress,
      agent.avatarUrl,
      agent.username
    );

    if (!prepared) {
      return c.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to prepare registration transaction. Check server logs." } },
        500
      );
    }

    return c.json({ success: true, data: prepared });
  } catch (err) {
    console.error("[register/prepare] Error:", err instanceof Error ? err.message : err);
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unexpected error" } },
      500
    );
  }
});

/**
 * POST /agents/:id/register-confirm
 *
 * Confirm on-chain registration after human signed and sent the tx.
 */
registerRouter.post("/agents/:id/register-confirm", async (c) => {
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

  const body = await c.req.json<{ registryAssetId: string; txSignature: string }>().catch(() => ({ registryAssetId: "", txSignature: "" }));
  if (!body.registryAssetId) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "registryAssetId is required" } },
      400
    );
  }

  const confirmed = await confirmRegistration(agentId, body.registryAssetId);
  if (!confirmed) {
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to confirm registration" } },
      500
    );
  }

  logAudit({
    action: "agent_registry_registered",
    userId: user.userId,
    agentId: agent.id,
    metadata: { registryAssetId: body.registryAssetId, txSignature: body.txSignature },
  });

  return c.json({ success: true, data: { registryAssetId: body.registryAssetId } }, 201);
});
