import { readdir } from "node:fs/promises";

const FIRST_UNCONSOLIDATED_MIGRATION = 6;
const BASELINE = "scripts/setup-database.sql";

/** Migrations 0000-0005 are already consolidated into the baseline script. */
export async function getDatabaseSqlFiles() {
  const entries = await readdir("drizzle");
  const migrations = entries
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .filter((file) => Number(file.slice(0, 4)) >= FIRST_UNCONSOLIDATED_MIGRATION)
    .sort();

  return [BASELINE, ...migrations.map((file) => `drizzle/${file}`)];
}
