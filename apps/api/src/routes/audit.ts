import { Hono } from "hono";
import { db, auditLogs, agents } from "@envoy/db";
import { eq, desc, count, inArray, and, gte, lte, type SQL } from "drizzle-orm";
import type { AuthEnv } from "../middleware/auth";

export const auditRouter = new Hono<AuthEnv>();

/**
 * GET / -- List all audit log entries for agents owned by the authenticated user
 *
 * Query params:
 * - limit (default 50, max 100)
 * - offset (default 0)
 * - action — filter by action type (e.g. "agent_created", "manifest_issued")
 * - from — ISO date string, entries after this timestamp
 * - to — ISO date string, entries before this timestamp
 */
auditRouter.get("/", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;
  const action = c.req.query("action");
  const from = c.req.query("from");
  const to = c.req.query("to");

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

  // Build filter conditions
  const conditions: SQL[] = [inArray(auditLogs.agentId, agentIds)];

  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      conditions.push(gte(auditLogs.createdAt, fromDate));
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      conditions.push(lte(auditLogs.createdAt, toDate));
    }
  }

  const whereClause = and(...conditions);

  const [entries, [totalRow]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause),
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
