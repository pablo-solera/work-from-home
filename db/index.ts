import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DatabaseState = {
  client: ReturnType<typeof postgres> | null;
  db: PostgresJsDatabase<typeof schema> | null;
};

declare global {
  var __wfhDatabaseState: DatabaseState | undefined;
}

const state: DatabaseState = globalThis.__wfhDatabaseState ?? { client: null, db: null };
globalThis.__wfhDatabaseState = state;

export function getPostgresClient() {
  if (state.client) return state.client;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to access the database.");
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  state.client = postgres({
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
  return state.client;
}

export function getDb() {
  if (state.db) {
    return state.db;
  }

  state.db = drizzle(getPostgresClient(), { schema });

  return state.db;
}
