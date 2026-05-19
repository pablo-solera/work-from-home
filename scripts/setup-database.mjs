import bcrypt from "bcryptjs";
import postgres from "postgres";

const databaseUrl = process.env.APP_DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminName = process.env.ADMIN_NAME || "Admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

if (!databaseUrl) {
  console.error("DATABASE_URL is required to set up the database.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function ensureRoleEnum() {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'coordinator', 'employee');
      END IF;
    END
    $$
  `;

  await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'`;
  await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinator'`;
  await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee'`;
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role user_role DEFAULT 'employee' NOT NULL,
      coordinator_id uuid,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS coordinator_id uuid`;
  await sql`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee'`;
  await sql`UPDATE users SET role = 'employee' WHERE role::text = 'user'`;

  await sql`
    CREATE TABLE IF NOT EXISTS work_from_home_days (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid NOT NULL,
      date date NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS work_from_home_days_user_date_idx
    ON work_from_home_days USING btree (user_id, date)
  `;
}

async function ensureConstraints() {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_coordinator_id_users_id_fk') THEN
        ALTER TABLE users
        ADD CONSTRAINT users_coordinator_id_users_id_fk
        FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END
    $$
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_from_home_days_user_id_users_id_fk') THEN
        ALTER TABLE work_from_home_days
        ADD CONSTRAINT work_from_home_days_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END
    $$
  `;
}

async function ensureAdminUser() {
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${adminName}, ${adminEmail.toLowerCase()}, ${passwordHash}, 'admin')
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      coordinator_id = NULL
  `;
}

async function main() {
  await ensureRoleEnum();
  await ensureTables();
  await ensureConstraints();
  await ensureAdminUser();

  console.log("Database setup completed.");
  console.log(`Admin user: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
