import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const platforms = pgTable("platforms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
