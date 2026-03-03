import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const pairings = pgTable("pairings", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  secretHash: text("secret_hash").notNull(),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
