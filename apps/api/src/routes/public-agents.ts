import { Hono } from "hono";
import { db, agents } from "@envoy/db";
import { eq, and, ilike, or, isNotNull, count, desc, sql, type SQL } from "drizzle-orm";

export const publicAgentsRouter = new Hono();

/**
 * GET /agents/public
 * Public endpoint (no auth). Returns a paginated list of active agents
 * that have a public username.
 *
 * Query params:
 * - search — case-insensitive search on name, username, description
 * - scope — filter agents that include this scope
 * - limit (default 24, max 100)
 * - offset (default 0)
 */
publicAgentsRouter.get("/agents/public", async (c) => {
  const search = c.req.query("search")?.trim();
  const scope = c.req.query("scope")?.trim();
  const limit = Math.min(Number(c.req.query("limit")) || 24, 100);
  const offset = Number(c.req.query("offset")) || 0;

  // Base: only active agents with a username
  const conditions: SQL[] = [
    eq(agents.status, "active"),
    isNotNull(agents.username),
  ];

  // Search filter
  if (search && search.length > 0) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(agents.name, pattern),
        ilike(agents.username, pattern),
        ilike(agents.description, pattern),
      )!
    );
  }

  // Scope filter (JSONB contains)
  if (scope && scope.length > 0) {
    conditions.push(sql`${agents.scopes}::jsonb @> ${JSON.stringify([scope])}::jsonb`);
  }

  const where = and(...conditions);

  const [agentList, [totalRow]] = await Promise.all([
    db
      .select({
        id: agents.id,
        name: agents.name,
        username: agents.username,
        description: agents.description,
        avatarUrl: agents.avatarUrl,
        status: agents.status,
        walletAddress: agents.walletAddress,
        registryAssetId: agents.registryAssetId,
        socialMoltbook: agents.socialMoltbook,
        socialX: agents.socialX,
        scopes: agents.scopes,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .where(where)
      .orderBy(desc(agents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(agents).where(where),
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
      registryAssetId: agent.registryAssetId,
      socialMoltbook: agent.socialMoltbook,
      socialX: agent.socialX,
      scopes: agent.scopes,
      createdAt: agent.createdAt,
    },
  });
});
