ALTER TABLE "wfh_change_requests" ADD COLUMN IF NOT EXISTS "coordinator_notified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wfh_change_requests" ADD COLUMN IF NOT EXISTS "coordinator_acknowledged_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfh_change_requests_coordinator_notification_idx" ON "wfh_change_requests" USING btree ("coordinator_id","coordinator_notified_at","coordinator_acknowledged_at");
