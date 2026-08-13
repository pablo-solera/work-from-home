DO $$ BEGIN
  ALTER TYPE "public"."wfh_request_kind" ADD VALUE IF NOT EXISTS 'removal';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
