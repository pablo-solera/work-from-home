CREATE OR REPLACE FUNCTION notify_wfh_request_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  coordinator_id uuid;
  requester_id uuid;
  notify_requester boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'wfh_change_request_dates' THEN
    SELECT r.coordinator_id, r.requester_id
      INTO coordinator_id, requester_id
    FROM wfh_change_requests r
    WHERE r.id = COALESCE(NEW.request_id, OLD.request_id);
    notify_requester := true;
  ELSE
    coordinator_id := NEW.coordinator_id;
    requester_id := NEW.requester_id;
    notify_requester := TG_OP = 'UPDATE'
      AND OLD.status = 'pending'
      AND NEW.status <> 'pending';
  END IF;

  IF coordinator_id IS NOT NULL THEN
    PERFORM pg_notify(
      'wfh_request_changed',
      json_build_object(
        'coordinatorId', coordinator_id,
        'requesterId', requester_id,
        'notifyRequester', notify_requester
      )::text
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
