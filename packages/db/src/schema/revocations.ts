import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { manifests } from "./manifests";

export const revocations = pgTable("revocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  manifestId: uuid("manifest_id")
    .notNull()
    .references(() => manifests.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
