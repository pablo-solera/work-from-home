DO $$ BEGIN
  ALTER TYPE "public"."wfh_request_status" ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "wfh_change_request_dates" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wfh_change_request_dates" ADD COLUMN IF NOT EXISTS "cancelled_by_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wfh_change_request_dates" ADD CONSTRAINT "wfh_change_request_dates_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfh_change_request_dates_active_date_idx" ON "wfh_change_request_dates" USING btree ("requested_date");
