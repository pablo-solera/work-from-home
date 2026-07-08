ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fallback_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fallback_name" text;--> statement-breakpoint
UPDATE "users" SET "fallback_email" = "email", "fallback_name" = "name" WHERE "oracle_emp_id" IS NULL AND "fallback_email" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_oracle_emp_id_unique" ON "users" ("oracle_emp_id") WHERE "oracle_emp_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_fallback_email_unique" ON "users" ("fallback_email") WHERE "fallback_email" IS NOT NULL;
