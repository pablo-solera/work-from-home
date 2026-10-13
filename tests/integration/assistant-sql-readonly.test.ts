import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
const sql = postgres(databaseUrl, { max: 1 });

describe("assistant Postgres read-only transaction", () => {
  afterAll(async () => { await sql.end(); });

  it("rejects writes inside the assistant read-only transaction", async () => {
    await expect(sql.begin(async (transaction) => {
      await transaction`set transaction read only`;
      await transaction`insert into users (oracle_emp_id, has_wfh) values (987654321, false)`;
    })).rejects.toThrow(/read.only|read only/i);
  });
});
