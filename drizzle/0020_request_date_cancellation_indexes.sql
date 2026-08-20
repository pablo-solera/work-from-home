CREATE INDEX IF NOT EXISTS wfh_change_request_dates_cancelled_idx
  ON wfh_change_request_dates (request_id, cancelled_at)
  WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS wfh_change_request_dates_pending_date_idx
  ON wfh_change_request_dates (requested_date, request_id)
  WHERE cancelled_at IS NULL;
