ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS admin_notified_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS admin_acknowledged_at timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfh_change_requests_admin_notification_idx" ON "wfh_change_requests" USING btree ("admin_notified_at", "admin_acknowledged_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION notify_wfh_request_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_coordinator_id uuid;
  target_requester_id uuid;
  request_kind wfh_request_kind;
  notify_requester boolean := false;
  notify_admins boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'wfh_change_request_dates' THEN
    SELECT r.coordinator_id, r.requester_id, r.kind
      INTO target_coordinator_id, target_requester_id, request_kind
    FROM wfh_change_requests r
    WHERE r.id = COALESCE(NEW.request_id, OLD.request_id);
    notify_requester := true;
  ELSE
    target_coordinator_id := NEW.coordinator_id;
    target_requester_id := NEW.requester_id;
    request_kind := NEW.kind;
    notify_requester := TG_OP = 'UPDATE'
      AND OLD.status = 'pending'
      AND NEW.status <> 'pending';
  END IF;

  notify_admins := request_kind = 'additional' OR EXISTS (
    SELECT 1 FROM wfh_change_requests r
    WHERE r.requester_id = target_requester_id AND r.admin_notified_at IS NOT NULL
  );

  IF target_coordinator_id IS NOT NULL OR notify_admins THEN
    PERFORM pg_notify(
      'wfh_request_changed',
      json_build_object(
        'coordinatorId', target_coordinator_id,
        'requesterId', target_requester_id,
        'notifyRequester', notify_requester,
        'notifyAdmins', notify_admins
      )::text
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
