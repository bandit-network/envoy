import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { users } from "./users";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  // Append-only: no updatedAt
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
