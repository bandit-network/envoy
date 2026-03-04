import { pgTable, uuid, text, timestamp, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "suspended",
  "revoked",
]);

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  socialMoltbook: text("social_moltbook"),
  socialX: text("social_x"),
  scopes: jsonb("scopes").$type<string[]>().default(["api_access"]).notNull(),
  defaultTtl: integer("default_ttl"),
  status: agentStatusEnum("status").default("active").notNull(),
  walletAddress: text("wallet_address"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
