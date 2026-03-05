ALTER TABLE "users" ALTER COLUMN "privy_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address");