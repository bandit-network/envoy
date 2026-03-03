import { Hono } from "hono";
import { db, auditLogs, agents } from "@envoy/db";
import { eq, desc, count, inArray } from "drizzle-orm";
import type { AuthEnv } from "../middleware/auth";

export const auditRouter = new Hono<AuthEnv>();

/**
 * GET / -- List all audit log entries for agents owned by the authenticated user
 */
auditRouter.get("/", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  // First, get all agent IDs owned by this user
  const userAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.ownerId, user.userId));

  if (userAgents.length === 0) {
    return c.json({
      success: true,
      data: { entries: [], total: 0, limit, offset },
    });
  }

  const agentIds = userAgents.map((a) => a.id);
  const agentNameMap = new Map(userAgents.map((a) => [a.id, a.name]));

  const [entries, [totalRow]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(inArray(auditLogs.agentId, agentIds))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(inArray(auditLogs.agentId, agentIds)),
  ]);

  // Attach agent name to each entry
  const enriched = entries.map((entry) => ({
    ...entry,
    agentName: entry.agentId ? agentNameMap.get(entry.agentId) ?? null : null,
  }));

  return c.json({
    success: true,
    data: {
      entries: enriched,
      total: totalRow?.total ?? 0,
      limit,
      offset,
    },
  });
});
