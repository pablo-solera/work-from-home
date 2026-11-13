-- Notification summaries used to aggregate the whole request history and run a correlated
-- subquery per row to build a revision. Keep a per-row updated_at instead (set by a BEFORE
-- UPDATE trigger, so it never adds NOTIFY traffic) and index the exact rows each counter reads.
ALTER TABLE wfh_change_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION touch_wfh_change_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wfh_change_requests_touch_trigger ON wfh_change_requests;
CREATE TRIGGER wfh_change_requests_touch_trigger
BEFORE UPDATE ON wfh_change_requests
FOR EACH ROW EXECUTE FUNCTION touch_wfh_change_request_updated_at();

CREATE INDEX IF NOT EXISTS wfh_change_requests_updated_at_idx
  ON wfh_change_requests (updated_at DESC);

CREATE INDEX IF NOT EXISTS wfh_change_request_dates_cancelled_at_idx
  ON wfh_change_request_dates (cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS wfh_change_requests_pending_additional_idx
  ON wfh_change_requests (coordinator_id)
  WHERE kind = 'additional' AND status = 'pending';

CREATE INDEX IF NOT EXISTS wfh_change_requests_admin_unread_substitution_idx
  ON wfh_change_requests (admin_notified_at)
  WHERE kind = 'substitution' AND admin_notified_at IS NOT NULL AND admin_acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS wfh_change_requests_coordinator_unread_idx
  ON wfh_change_requests (coordinator_id)
  WHERE kind IN ('substitution', 'removal') AND coordinator_notified_at IS NOT NULL AND coordinator_acknowledged_at IS NULL;
