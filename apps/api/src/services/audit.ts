import { db, auditLogs } from "@envoy/db";

interface AuditParams {
  action: string;
  userId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an entry to the audit log.
 * Fire-and-forget: catches errors internally, never throws.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: params.action,
      userId: params.userId ?? null,
      agentId: params.agentId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
