CREATE INDEX IF NOT EXISTS "wfh_change_requests_kind_status_created_idx" ON "wfh_change_requests" USING btree ("kind", "status", "created_at", "id");
