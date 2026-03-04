import { Hono } from "hono";
import { db, agents } from "@envoy/db";
import { eq, and } from "drizzle-orm";

export const publicAgentsRouter = new Hono();

/**
 * GET /agents/public/:username
 * Public endpoint (no auth). Returns public agent profile data.
 * Only active agents are visible — suspended and revoked return 404.
 */
publicAgentsRouter.get("/agents/public/:username", async (c) => {
  const username = c.req.param("username");

  if (!username || username.length < 1 || username.length > 39) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid username" } },
      400
    );
  }

  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.username, username),
      eq(agents.status, "active")
    ),
  });

  if (!agent) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Agent not found" } },
      404
    );
  }

  // Return only public-safe fields
  return c.json({
    success: true,
    data: {
      id: agent.id,
      name: agent.name,
      username: agent.username,
      description: agent.description,
      avatarUrl: agent.avatarUrl,
      status: agent.status,
      walletAddress: agent.walletAddress,
      socialMoltbook: agent.socialMoltbook,
      socialX: agent.socialX,
      scopes: agent.scopes,
      createdAt: agent.createdAt,
    },
  });
});
