import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const manifests = pgTable("manifests", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  manifestJson: jsonb("manifest_json").notNull(),
  signature: text("signature").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
