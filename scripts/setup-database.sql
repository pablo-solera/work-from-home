CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Identity (name/email) and organization roles live in Oracle (TIMERTASK).
-- PostgreSQL stores user mappings and work-from-home options. Authentication
-- is handled by LDAP or the explicitly configured test accounts. System
-- accounts use fallback_email/fallback_name to identify their local mapping.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  oracle_emp_id integer,
  fallback_email text,
  fallback_name text,
  has_wfh boolean,
  team_wfh_visible boolean DEFAULT false NOT NULL,
  can_edit_all_wfh boolean DEFAULT false NOT NULL,
  wfh_days_allowance integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Keep existing databases compatible with the current users table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS oracle_emp_id integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fallback_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fallback_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_wfh boolean;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_wfh_visible boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_all_wfh boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wfh_days_allowance integer;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- The Workday number (wd_number) now lives in Oracle (TEMPLEADOS.EMP_TEL1).
ALTER TABLE users DROP COLUMN IF EXISTS wd_number;

-- Migrate legacy identity columns into fallback_* for system accounts.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email') THEN
    UPDATE users SET fallback_email = email WHERE oracle_emp_id IS NULL AND fallback_email IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name') THEN
    UPDATE users SET fallback_name = name WHERE oracle_emp_id IS NULL AND fallback_name IS NULL;
  END IF;
END
$$;

DROP INDEX IF EXISTS users_email_unique;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS name;
ALTER TABLE users DROP COLUMN IF EXISTS coordinator_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;

CREATE UNIQUE INDEX IF NOT EXISTS users_oracle_emp_id_unique ON users (oracle_emp_id) WHERE oracle_emp_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_fallback_email_unique ON users (fallback_email) WHERE fallback_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS work_from_home_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE work_from_home_days ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE work_from_home_days ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE work_from_home_days ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS work_from_home_days_user_date_idx
  ON work_from_home_days (user_id, date);
CREATE INDEX IF NOT EXISTS work_from_home_days_date_user_idx
  ON work_from_home_days (date, user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_from_home_days_user_id_users_id_fk') THEN
    ALTER TABLE work_from_home_days
      ADD CONSTRAINT work_from_home_days_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE wfh_request_kind AS ENUM ('additional', 'substitution');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE wfh_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TYPE wfh_request_status ADD VALUE IF NOT EXISTS 'cancelled';

CREATE TABLE IF NOT EXISTS wfh_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  requester_id uuid NOT NULL,
  coordinator_id uuid,
  kind wfh_request_kind NOT NULL,
  status wfh_request_status DEFAULT 'pending' NOT NULL,
  requester_comment text,
  decision_comment text,
  decided_by_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  decided_at timestamp with time zone,
  coordinator_notified_at timestamp with time zone,
  coordinator_acknowledged_at timestamp with time zone,
  admin_notified_at timestamp with time zone,
  admin_acknowledged_at timestamp with time zone
);

ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS requester_id uuid;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS coordinator_id uuid;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS kind wfh_request_kind;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS status wfh_request_status DEFAULT 'pending' NOT NULL;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS requester_comment text;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS decision_comment text;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS decided_by_id uuid;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS decided_at timestamp with time zone;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS coordinator_notified_at timestamp with time zone;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS coordinator_acknowledged_at timestamp with time zone;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS admin_notified_at timestamp with time zone;
ALTER TABLE wfh_change_requests ADD COLUMN IF NOT EXISTS admin_acknowledged_at timestamp with time zone;
ALTER TABLE wfh_change_requests ALTER COLUMN coordinator_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wfh_change_requests_requester_id_users_id_fk') THEN
    ALTER TABLE wfh_change_requests
      ADD CONSTRAINT wfh_change_requests_requester_id_users_id_fk
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wfh_change_requests_coordinator_id_users_id_fk') THEN
    ALTER TABLE wfh_change_requests
      ADD CONSTRAINT wfh_change_requests_coordinator_id_users_id_fk
      FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wfh_change_requests_decided_by_id_users_id_fk') THEN
    ALTER TABLE wfh_change_requests
      ADD CONSTRAINT wfh_change_requests_decided_by_id_users_id_fk
      FOREIGN KEY (decided_by_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS wfh_change_requests_requester_status_idx
  ON wfh_change_requests (requester_id, status);
CREATE INDEX IF NOT EXISTS wfh_change_requests_requester_created_idx
  ON wfh_change_requests (requester_id, created_at, id);
CREATE INDEX IF NOT EXISTS wfh_change_requests_coordinator_status_idx
  ON wfh_change_requests (coordinator_id, status);
CREATE INDEX IF NOT EXISTS wfh_change_requests_coordinator_created_idx
  ON wfh_change_requests (coordinator_id, created_at, id);
CREATE INDEX IF NOT EXISTS wfh_change_requests_kind_status_created_idx
  ON wfh_change_requests (kind, status, created_at, id);
CREATE INDEX IF NOT EXISTS wfh_change_requests_coordinator_notification_idx
  ON wfh_change_requests (coordinator_id, coordinator_notified_at, coordinator_acknowledged_at);
CREATE INDEX IF NOT EXISTS wfh_change_requests_admin_notification_idx
  ON wfh_change_requests (admin_notified_at, admin_acknowledged_at);

CREATE TABLE IF NOT EXISTS wfh_change_request_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  requested_date date NOT NULL,
  replaced_date date,
  cancelled_at timestamp with time zone,
  cancelled_by_id uuid
);

ALTER TABLE wfh_change_request_dates ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE wfh_change_request_dates ADD COLUMN IF NOT EXISTS requested_date date;
ALTER TABLE wfh_change_request_dates ADD COLUMN IF NOT EXISTS replaced_date date;
ALTER TABLE wfh_change_request_dates ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
ALTER TABLE wfh_change_request_dates ADD COLUMN IF NOT EXISTS cancelled_by_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wfh_change_request_dates_request_id_wfh_change_requests_id_fk') THEN
    ALTER TABLE wfh_change_request_dates
      ADD CONSTRAINT wfh_change_request_dates_request_id_wfh_change_requests_id_fk
      FOREIGN KEY (request_id) REFERENCES wfh_change_requests(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wfh_change_request_dates_cancelled_by_id_users_id_fk') THEN
    ALTER TABLE wfh_change_request_dates
      ADD CONSTRAINT wfh_change_request_dates_cancelled_by_id_users_id_fk
      FOREIGN KEY (cancelled_by_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS wfh_change_request_dates_request_date_idx
  ON wfh_change_request_dates (request_id, requested_date);
CREATE INDEX IF NOT EXISTS wfh_change_request_dates_active_date_idx
  ON wfh_change_request_dates (requested_date);

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

DROP TRIGGER IF EXISTS wfh_change_requests_notify_trigger ON wfh_change_requests;
CREATE TRIGGER wfh_change_requests_notify_trigger
AFTER INSERT OR UPDATE ON wfh_change_requests
FOR EACH ROW EXECUTE FUNCTION notify_wfh_request_changed();

DROP TRIGGER IF EXISTS wfh_change_request_dates_notify_trigger ON wfh_change_request_dates;
CREATE TRIGGER wfh_change_request_dates_notify_trigger
AFTER UPDATE OF cancelled_at ON wfh_change_request_dates
FOR EACH ROW EXECUTE FUNCTION notify_wfh_request_changed();

SELECT 'Database setup completed.' AS message;
