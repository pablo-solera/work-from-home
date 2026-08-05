CREATE INDEX IF NOT EXISTS "work_from_home_days_date_user_idx"
ON "work_from_home_days" USING btree ("date", "user_id");
