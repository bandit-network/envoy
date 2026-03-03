import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { platforms } from "./platforms";

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformId: uuid("platform_id")
    .notNull()
    .references(() => platforms.id),
  eventTypes: jsonb("event_types").$type<string[]>().notNull().default([]),
  url: text("url").notNull(),
  secretHash: text("secret_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
