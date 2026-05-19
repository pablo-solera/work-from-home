CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'coordinator', 'employee');
  END IF;
END
$$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role user_role DEFAULT 'employee' NOT NULL,
  coordinator_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users USING btree (email);

ALTER TABLE users ADD COLUMN IF NOT EXISTS coordinator_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'employee' NOT NULL;
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
UPDATE users SET role = 'employee' WHERE role::text = 'user';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
      AND udt_name <> 'user_role'
  ) THEN
    ALTER TABLE users ALTER COLUMN role SET DATA TYPE user_role USING role::text::user_role;
  END IF;
END
$$;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';

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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_coordinator_id_users_id_fk') THEN
    ALTER TABLE users
    ADD CONSTRAINT users_coordinator_id_users_id_fk
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_from_home_days_user_id_users_id_fk') THEN
    ALTER TABLE work_from_home_days
    ADD CONSTRAINT work_from_home_days_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;

INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', lower('admin@example.com'), crypt('admin', gen_salt('bf')), 'admin')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  coordinator_id = NULL;

SELECT 'Database setup completed.' AS message;
SELECT lower(:'admin_email') AS admin_email;
