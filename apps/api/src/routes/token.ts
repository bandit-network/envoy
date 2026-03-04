import { Hono } from "hono";
import { db, agents } from "@envoy/db";
import { eq } from "drizzle-orm";
import { verifyManifestToken } from "../lib/verifier";
import { refreshManifest } from "../services/manifest";
import { logAudit } from "../services/audit";
import type { ManifestPayload } from "@envoy/types";

export const tokenRouter = new Hono();

/**
 * Grace period (in ms) for recently-expired tokens.
 * Agents that are slightly late refreshing can still recover.
 */
const REFRESH_GRACE_PERIOD_MS = Number(process.env.REFRESH_GRACE_PERIOD_MS) || 5 * 60 * 1000; // 5 minutes

/**
 * Extract and verify a Bearer token from the Authorization header.
 * Returns the manifest payload and verification result, or an error response.
 */
async function extractBearerToken(
  authHeader: string | undefined
): Promise<
  | { ok: true; manifest: ManifestPayload; revoked: boolean; expired: boolean }
  | { ok: false; status: number; code: string; message: string }
> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      message: "Missing or malformed Authorization header. Expected: Bearer <token>",
    };
  }

  const token = authHeader.slice(7);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      message: "Empty Bearer token",
    };
  }

  const result = await verifyManifestToken(token);

  if (!result.manifest) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      message: result.error ?? "Invalid or malformed token",
    };
  }

  return {
    ok: true,
    manifest: result.manifest,
    revoked: result.revoked,
    expired: result.expired,
  };
}

/**
 * POST /token/refresh — Agent self-refresh
 *
 * Agent presents its current signed manifest token as a Bearer token.
 * If the token is valid (or within the grace period), a new manifest is issued.
 * The old manifest is revoked.
 *
 * Auth: Bearer <manifest-token> (NOT Privy JWT)
 */
tokenRouter.post("/token/refresh", async (c) => {
  const authHeader = c.req.header("Authorization");
  const result = await extractBearerToken(authHeader);

  if (!result.ok) {
    return c.json(
      { success: false, error: { code: result.code, message: result.message } },
      result.status as 401
    );
  }

  const { manifest, revoked, expired } = result;

  // Revoked tokens cannot refresh — ever
  if (revoked) {
    return c.json(
      { success: false, error: { code: "TOKEN_REVOKED", message: "Token has been revoked and cannot be refreshed" } },
      401
    );
  }

  // Expired tokens: allow within grace period
  if (expired) {
    const expiresAt = new Date(manifest.expires_at);
    const graceDeadline = new Date(expiresAt.getTime() + REFRESH_GRACE_PERIOD_MS);

    if (new Date() > graceDeadline) {
      return c.json(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: `Token expired beyond the ${REFRESH_GRACE_PERIOD_MS / 60_000}-minute grace period. Please re-pair with your human operator.`,
          },
        },
        401
      );
    }
    // Within grace period — allow refresh
  }

  // Look up the agent to ensure it's still active
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, manifest.agent_id),
  });

  if (!agent) {
    return c.json(
      { success: false, error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  if (agent.status !== "active") {
    return c.json(
      {
        success: false,
        error: {
          code: "AGENT_INACTIVE",
          message: `Agent is ${agent.status}. Cannot refresh token.`,
        },
      },
      403
    );
  }

  // Issue new manifest (revokes old one atomically)
  try {
    const newManifest = await refreshManifest(agent.id, agent.ownerId);

    logAudit({
      action: "token_self_refreshed",
      agentId: agent.id,
      metadata: {
        oldManifestIssuedAt: manifest.issued_at,
        newManifestId: newManifest.manifestId,
      },
    });

    return c.json({
      success: true,
      data: {
        manifestId: newManifest.manifestId,
        manifestJson: newManifest.manifestJson,
        signature: newManifest.signature,
        expiresAt: newManifest.expiresAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh manifest";
    return c.json(
      { success: false, error: { code: "REFRESH_FAILED", message } },
      500
    );
  }
});

/**
 * GET /token/status — Agent status check
 *
 * Agent presents its manifest token to check its own status.
 * Works even for expired/revoked tokens — returns informational status.
 *
 * Auth: Bearer <manifest-token> (NOT Privy JWT)
 */
tokenRouter.get("/token/status", async (c) => {
  const authHeader = c.req.header("Authorization");
  const result = await extractBearerToken(authHeader);

  if (!result.ok) {
    return c.json(
      { success: false, error: { code: result.code, message: result.message } },
      result.status as 401
    );
  }

  const { manifest, revoked, expired } = result;

  // Look up agent for current status
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, manifest.agent_id),
  });

  const agentStatus = agent?.status ?? "unknown";

  return c.json({
    success: true,
    data: {
      agentId: manifest.agent_id,
      agentName: manifest.agent_name,
      status: agentStatus,
      tokenExpired: expired,
      tokenRevoked: revoked,
      tokenExpiresAt: manifest.expires_at,
      scopes: manifest.scopes ?? [],
    },
  });
});
