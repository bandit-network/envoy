import { Hono } from "hono";
import { db, agents, platforms, manifests, auditLogs, orgMembers } from "@envoy/db";
import { eq, and, count, isNull, desc, gte, inArray, or, sql } from "drizzle-orm";
import type { AuthEnv } from "../middleware/auth";

export const statsRouter = new Hono<AuthEnv>();

/**
 * GET / -- Dashboard stats for the authenticated user
 *
 * Returns aggregated metrics: agent counts by status, platform count,
 * manifest counts, recent activity, and agent creation timeline.
 * Includes agents from user's organizations.
 */
statsRouter.get("/", async (c) => {
  const user = c.get("user");
  const userId = user.userId;

  // Get org IDs the user belongs to (for team agent stats)
  const userOrgMemberships = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  const userOrgIds = userOrgMemberships.map((m) => m.orgId);

  // Ownership condition: user's own agents + org agents
  const ownerCondition =
    userOrgIds.length > 0
      ? or(eq(agents.ownerId, userId), inArray(agents.orgId, userOrgIds))!
      : eq(agents.ownerId, userId);

  // Get all agent IDs for this user (needed for manifest + audit queries)
  const userAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(ownerCondition);

  const agentIds = userAgents.map((a) => a.id);
  const agentNameMap = new Map(userAgents.map((a) => [a.id, a.name]));

  // Run all queries in parallel
  const [
    [totalAgents],
    [activeAgents],
    [suspendedAgents],
    [revokedAgents],
    [totalPlatforms],
    [totalManifests],
    [activeManifests],
    recentActivity,
    agentTimeline,
  ] = await Promise.all([
    db.select({ total: count() }).from(agents).where(ownerCondition),
    db.select({ total: count() }).from(agents).where(and(ownerCondition, eq(agents.status, "active"))),
    db.select({ total: count() }).from(agents).where(and(ownerCondition, eq(agents.status, "suspended"))),
    db.select({ total: count() }).from(agents).where(and(ownerCondition, eq(agents.status, "revoked"))),
    db.select({ total: count() }).from(platforms).where(eq(platforms.ownerId, userId)),
    // Manifests for user's agents
    agentIds.length > 0
      ? db.select({ total: count() }).from(manifests).where(inArray(manifests.agentId, agentIds))
      : Promise.resolve([{ total: 0 }]),
    agentIds.length > 0
      ? db.select({ total: count() }).from(manifests).where(and(inArray(manifests.agentId, agentIds), isNull(manifests.revokedAt)))
      : Promise.resolve([{ total: 0 }]),
    // Recent audit entries
    agentIds.length > 0
      ? db
          .select()
          .from(auditLogs)
          .where(inArray(auditLogs.agentId, agentIds))
          .orderBy(desc(auditLogs.createdAt))
          .limit(5)
      : Promise.resolve([]),
    // Agent creation timeline (last 30 days, grouped by day)
    db
      .select({
        day: sql<string>`to_char(${agents.createdAt}::date, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(agents)
      .where(
        and(
          ownerCondition,
          gte(agents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(sql`${agents.createdAt}::date`)
      .orderBy(sql`${agents.createdAt}::date`),
  ]);

  // Enrich audit entries with agent names
  const enrichedActivity = recentActivity.map((entry) => ({
    ...entry,
    agentName: entry.agentId ? agentNameMap.get(entry.agentId) ?? null : null,
  }));

  return c.json({
    success: true,
    data: {
      agents: {
        total: totalAgents?.total ?? 0,
        active: activeAgents?.total ?? 0,
        suspended: suspendedAgents?.total ?? 0,
        revoked: revokedAgents?.total ?? 0,
      },
      platforms: {
        total: totalPlatforms?.total ?? 0,
      },
      manifests: {
        total: totalManifests?.total ?? 0,
        active: activeManifests?.total ?? 0,
      },
      recentActivity: enrichedActivity,
      agentTimeline,
    },
  });
});
