CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Identity (name/email) and organization roles live in Oracle (TIMERTASK).
-- Postgres stores login credentials and work-from-home options. System accounts
-- (no Oracle employee) use fallback_email/fallback_name to log in.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  password_hash text NOT NULL,
  oracle_emp_id integer,
  fallback_email text,
  fallback_name text,
  has_wfh boolean,
  team_wfh_visible boolean DEFAULT false NOT NULL,
  can_edit_all_wfh boolean DEFAULT false NOT NULL,
  wfh_days_allowance integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Idempotent columns (for pre-existing databases).
ALTER TABLE users ADD COLUMN IF NOT EXISTS oracle_emp_id integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fallback_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fallback_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_wfh boolean;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_wfh_visible boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_all_wfh boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wfh_days_allowance integer;

-- The Workday number (wd_number) now lives in Oracle (TEMPLEADOS.EMP_TEL1).
ALTER TABLE users DROP COLUMN IF EXISTS wd_number;

-- Migrate legacy identity columns into fallback_* for system accounts, then drop them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email') THEN
    UPDATE users SET fallback_email = email WHERE oracle_emp_id IS NULL AND fallback_email IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='name') THEN
    UPDATE users SET fallback_name = name WHERE oracle_emp_id IS NULL AND fallback_name IS NULL;
  END IF;
END
$$;

DROP INDEX IF EXISTS users_email_unique;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS name;

CREATE UNIQUE INDEX IF NOT EXISTS users_oracle_emp_id_unique ON users (oracle_emp_id) WHERE oracle_emp_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_fallback_email_unique ON users (fallback_email) WHERE fallback_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS work_from_home_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS work_from_home_days_user_date_idx
ON work_from_home_days USING btree (user_id, date);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_from_home_days_user_id_users_id_fk') THEN
    ALTER TABLE work_from_home_days
    ADD CONSTRAINT work_from_home_days_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;

SELECT 'Database setup completed.' AS message;
