CREATE INDEX IF NOT EXISTS wfh_change_requests_requester_status_created_idx
  ON wfh_change_requests (requester_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS wfh_change_requests_coordinator_status_created_idx
  ON wfh_change_requests (coordinator_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS wfh_change_requests_admin_substitution_feed_idx
  ON wfh_change_requests (created_at DESC, id DESC)
  WHERE kind = 'substitution' AND admin_notified_at IS NOT NULL;
