import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { platforms } from "./platforms";

export const platformApiKeys = pgTable("platform_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformId: uuid("platform_id")
    .notNull()
    .references(() => platforms.id),
  keyHash: text("key_hash").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
