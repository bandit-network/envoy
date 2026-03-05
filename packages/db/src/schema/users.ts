import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** @deprecated Privy user ID — nullable for wallet-auth users */
  privyUserId: text("privy_user_id").unique(),
  /** Solana wallet public key (base58) — primary identifier for wallet auth */
  walletAddress: text("wallet_address").unique(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
