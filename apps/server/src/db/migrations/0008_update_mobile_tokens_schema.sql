-- Custom SQL migration file, put your code below! --

-- Update mobile_tokens schema for one-time pairing tokens
-- Remove old columns (is_enabled, rotated_at) and add new columns (expires_at, created_by, used_at)

-- Step 1: Clear existing tokens (breaking change - old schema incompatible)
DELETE FROM "mobile_tokens";

-- Step 2: Drop old columns
ALTER TABLE "mobile_tokens" DROP COLUMN IF EXISTS "is_enabled";
ALTER TABLE "mobile_tokens" DROP COLUMN IF EXISTS "rotated_at";

-- Step 3: Add new required column with temporary default (IF NOT EXISTS for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mobile_tokens' AND column_name = 'expires_at') THEN
    ALTER TABLE "mobile_tokens" ADD COLUMN "expires_at" timestamp with time zone NOT NULL DEFAULT NOW() + INTERVAL '15 minutes';
  END IF;
END $$;

-- Step 4: Add nullable columns (IF NOT EXISTS for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mobile_tokens' AND column_name = 'created_by') THEN
    ALTER TABLE "mobile_tokens" ADD COLUMN "created_by" uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mobile_tokens' AND column_name = 'used_at') THEN
    ALTER TABLE "mobile_tokens" ADD COLUMN "used_at" timestamp with time zone;
  END IF;
END $$;

-- Step 5: Add foreign key constraint (IF NOT EXISTS for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'mobile_tokens_created_by_users_id_fk') THEN
    ALTER TABLE "mobile_tokens" ADD CONSTRAINT "mobile_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- Step 6: Remove temporary default from expires_at
ALTER TABLE "mobile_tokens" ALTER COLUMN "expires_at" DROP DEFAULT;
