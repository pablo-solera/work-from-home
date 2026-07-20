import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getPostgresClient() {
  if (client) return client;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to access the database.");
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  client = postgres({
    connect_timeout: 30,
    database: databaseUrl.pathname.slice(1),
    host: databaseUrl.hostname,
    idle_timeout: 30,
    max: 10,
    max_lifetime: 60 * 30,
    password: decodeURIComponent(databaseUrl.password),
    port: databaseUrl.port ? Number(databaseUrl.port) : 5432,
    username: decodeURIComponent(databaseUrl.username),
  });
  return client;
}

export function getDb() {
  if (db) {
    return db;
  }

  db = drizzle(getPostgresClient(), { schema });

  return db;
}
