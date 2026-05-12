import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: PostgresJsDatabase<typeof schema> | null = null;

export function getDb() {
  if (db) {
    return db;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to access the database.");
  }

  const client = postgres(process.env.DATABASE_URL);
  db = drizzle(client, { schema });

  return db;
}
