import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generateSql } from "@/scripts/wfh-import-sql";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");

const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
const userId = "00000000-0000-4000-8000-0000000000a1";
const empId = 91001;

async function cleanup() {
  await sql`DELETE FROM wfh_change_request_dates WHERE request_id IN (SELECT id FROM wfh_change_requests WHERE requester_id = ${userId})`;
  await sql`DELETE FROM wfh_change_requests WHERE requester_id = ${userId}`;
  await sql`DELETE FROM work_from_home_days WHERE user_id = ${userId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

async function createRequest(kind: "additional" | "substitution" | "removal", status: "pending" | "accepted", requestedDate: string, replacedDate: string | null = null) {
  const [request] = await sql`INSERT INTO wfh_change_requests (requester_id, kind, status) VALUES (${userId}, ${kind}, ${status}) RETURNING id`;
  await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date) VALUES (${request.id}, ${requestedDate}, ${replacedDate})`;
}

async function runImport(excelDates: string[]) {
  const script = generateSql([{ empId, dates: excelDates, sourceRow: 2 }], "Hoja", "test.xlsx");
  try {
    await sql.unsafe(script);
  } catch (error) {
    await sql.unsafe("ROLLBACK");
    throw error;
  }
}

async function importedDays() {
  const rows = await sql`SELECT date::text AS date FROM work_from_home_days WHERE user_id = ${userId} ORDER BY date`;
  return rows.map((row) => row.date);
}

describe("generated WFH import SQL", () => {
  beforeEach(async () => {
    await cleanup();
    await sql`INSERT INTO users (id, oracle_emp_id, fallback_name) VALUES (${userId}, ${empId}, 'Import Test')`;
    await sql`INSERT INTO work_from_home_days (user_id, date) VALUES (${userId}, '2026-02-02')`;
  });

  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it("replaces the 2026 days with the spreadsheet", async () => {
    await runImport(["2026-03-02", "2026-03-03"]);
    expect(await importedDays()).toEqual(["2026-03-02", "2026-03-03"]);
  });

  it("does not stop for an accepted removal whose day is not in the spreadsheet", async () => {
    await createRequest("removal", "accepted", "2026-03-04");
    await runImport(["2026-03-02"]);
    expect(await importedDays()).toEqual(["2026-03-02"]);
  });

  it("does not stop for a pending additional request", async () => {
    await createRequest("additional", "pending", "2026-03-05");
    await runImport(["2026-03-02"]);
    expect(await importedDays()).toEqual(["2026-03-02"]);
  });

  it("stops when an accepted additional day is missing from the spreadsheet", async () => {
    await createRequest("additional", "accepted", "2026-03-06");
    await expect(runImport(["2026-03-02"])).rejects.toThrow(/1 solicitudes aceptadas[\s\S]*oracle_emp_id 91001, 2026-03-06, additional/);
    expect(await importedDays()).toEqual(["2026-02-02"]);
  });

  it("stops when an accepted removal day is still in the spreadsheet", async () => {
    await createRequest("removal", "accepted", "2026-03-09");
    await expect(runImport(["2026-03-09"])).rejects.toThrow(/2026-03-09, removal: el día anulado sigue en el Excel/);
  });

  it("stops when the replaced day of an accepted substitution is still in the spreadsheet", async () => {
    await createRequest("substitution", "accepted", "2026-03-11", "2026-03-10");
    await expect(runImport(["2026-03-10", "2026-03-11"])).rejects.toThrow(/2026-03-10, substitution: el día sustituido sigue en el Excel/);
  });
});
