ALTER TABLE "agents" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "social_moltbook" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "social_x" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_username_unique" UNIQUE("username");