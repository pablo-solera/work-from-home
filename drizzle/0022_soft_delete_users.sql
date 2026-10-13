ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE INDEX IF NOT EXISTS users_deactivated_at_idx
  ON users (deactivated_at)
  WHERE deactivated_at IS NOT NULL;
