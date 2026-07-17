CREATE INDEX IF NOT EXISTS "wfh_change_requests_coordinator_status_idx" ON "wfh_change_requests" USING btree ("coordinator_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfh_change_requests_coordinator_notification_idx" ON "wfh_change_requests" USING btree ("coordinator_id", "coordinator_notified_at", "coordinator_acknowledged_at");
