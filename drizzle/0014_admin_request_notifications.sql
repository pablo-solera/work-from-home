-- NOTE: This historical function body references users.role, which is removed
-- by migration 0016. The file remains unchanged for migration history; 0015
-- and 0016 replace this function before it can be executed.
CREATE OR REPLACE FUNCTION notify_wfh_request_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  coordinator_id uuid;
  requester_id uuid;
  request_kind wfh_request_kind;
  admin_ids uuid[];
  notify_requester boolean := false;
  notify_admins boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'wfh_change_request_dates' THEN
    SELECT r.coordinator_id, r.requester_id, r.kind
      INTO coordinator_id, requester_id, request_kind
    FROM wfh_change_requests r
    WHERE r.id = COALESCE(NEW.request_id, OLD.request_id);
    notify_requester := true;
  ELSE
    coordinator_id := NEW.coordinator_id;
    requester_id := NEW.requester_id;
    request_kind := NEW.kind;
    notify_requester := TG_OP = 'UPDATE'
      AND OLD.status = 'pending'
      AND NEW.status <> 'pending';
  END IF;

  notify_admins := request_kind = 'additional';

  IF notify_admins THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO admin_ids
    FROM users
    WHERE role = 'admin';
  END IF;

  IF coordinator_id IS NOT NULL OR notify_admins THEN
    PERFORM pg_notify(
      'wfh_request_changed',
      json_build_object(
        'coordinatorId', coordinator_id,
        'requesterId', requester_id,
        'notifyRequester', notify_requester,
        'adminIds', admin_ids,
        'notifyAdmins', notify_admins
      )::text
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
