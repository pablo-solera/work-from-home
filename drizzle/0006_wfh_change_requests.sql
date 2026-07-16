DO $$ BEGIN
 CREATE TYPE "public"."wfh_request_kind" AS ENUM('additional', 'substitution');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."wfh_request_status" AS ENUM('pending', 'accepted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wfh_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"coordinator_id" uuid NOT NULL,
	"kind" "wfh_request_kind" NOT NULL,
	"status" "wfh_request_status" DEFAULT 'pending' NOT NULL,
	"requester_comment" text,
	"decision_comment" text,
	"decided_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wfh_change_request_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"requested_date" date NOT NULL,
	"replaced_date" date
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wfh_change_requests" ADD CONSTRAINT "wfh_change_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wfh_change_requests" ADD CONSTRAINT "wfh_change_requests_coordinator_id_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wfh_change_requests" ADD CONSTRAINT "wfh_change_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wfh_change_request_dates" ADD CONSTRAINT "wfh_change_request_dates_request_id_wfh_change_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."wfh_change_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wfh_change_request_dates_request_date_idx" ON "wfh_change_request_dates" USING btree ("request_id","requested_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfh_change_requests_requester_status_idx" ON "wfh_change_requests" USING btree ("requester_id","status");
