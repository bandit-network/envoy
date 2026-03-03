ALTER TABLE "platform_api_keys" ADD COLUMN "key_prefix" text NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_api_keys" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;