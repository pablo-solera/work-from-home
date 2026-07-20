CREATE INDEX IF NOT EXISTS "wfh_change_requests_requester_created_idx" ON "wfh_change_requests" USING btree ("requester_id", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfh_change_requests_coordinator_created_idx" ON "wfh_change_requests" USING btree ("coordinator_id", "created_at", "id");
