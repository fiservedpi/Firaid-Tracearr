-- Multi-server support: Add user_id to mobile_sessions
-- BREAKING CHANGE: Clears existing mobile sessions - users must re-pair devices

-- Clear existing data (notification_preferences has FK to mobile_sessions)
DELETE FROM "notification_preferences";--> statement-breakpoint
DELETE FROM "mobile_sessions";--> statement-breakpoint

-- Unrelated schema drift fix from drizzle-kit
ALTER TABLE "sessions" ALTER COLUMN "last_seen_at" DROP DEFAULT;--> statement-breakpoint

-- Add user_id column (required for multi-user mobile support)
ALTER TABLE "mobile_sessions" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint

-- Add foreign key constraint
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Add index for efficient user lookups
CREATE INDEX "mobile_sessions_user_idx" ON "mobile_sessions" USING btree ("user_id");
