CREATE OR REPLACE FUNCTION notify_wfh_request_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  coordinator_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'wfh_change_request_dates' THEN
    SELECT r.coordinator_id INTO coordinator_id
    FROM wfh_change_requests r
    WHERE r.id = COALESCE(NEW.request_id, OLD.request_id);
  ELSE
    coordinator_id := COALESCE(NEW.coordinator_id, OLD.coordinator_id);
  END IF;

  IF coordinator_id IS NOT NULL THEN
    PERFORM pg_notify('wfh_request_changed', coordinator_id::text);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS wfh_change_requests_notify_trigger ON wfh_change_requests;
--> statement-breakpoint
CREATE TRIGGER wfh_change_requests_notify_trigger
AFTER INSERT OR UPDATE ON wfh_change_requests
FOR EACH ROW EXECUTE FUNCTION notify_wfh_request_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS wfh_change_request_dates_notify_trigger ON wfh_change_request_dates;
--> statement-breakpoint
CREATE TRIGGER wfh_change_request_dates_notify_trigger
AFTER UPDATE OF cancelled_at ON wfh_change_request_dates
FOR EACH ROW EXECUTE FUNCTION notify_wfh_request_changed();
