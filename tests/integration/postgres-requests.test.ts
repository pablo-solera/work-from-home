import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createWfhRequest, cancelWfhRequestDate } from "@/lib/requests/request-service";
import type { SessionUser } from "@/lib/auth/session";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");

const sql = postgres(databaseUrl, { max: 2 });

const admin: SessionUser = { id: "00000000-0000-4000-8000-000000000001", name: "Admin Test", email: "admin-test@example.com", role: "admin" };
const coordinator: SessionUser = { id: "00000000-0000-4000-8000-000000000002", name: "Coordinator Test", email: "coordinator-test@example.com", role: "coordinator" };
const employee: SessionUser = { id: "00000000-0000-4000-8000-000000000003", name: "Employee Test", email: "employee-test@example.com", role: "employee" };

async function seedUsers() {
  await sql`
    INSERT INTO users (id, password_hash, fallback_email, fallback_name)
    VALUES
      (${admin.id}, 'test-hash', ${admin.email}, ${admin.name}),
      (${coordinator.id}, 'test-hash', ${coordinator.email}, ${coordinator.name}),
      (${employee.id}, 'test-hash', ${employee.email}, ${employee.name})
  `;
}

describe("request persistence on PostgreSQL", () => {
  beforeEach(async () => {
    await sql`DELETE FROM wfh_change_request_dates`;
    await sql`DELETE FROM wfh_change_requests`;
    await sql`DELETE FROM work_from_home_days`;
    await sql`DELETE FROM users WHERE id IN (${admin.id}, ${coordinator.id}, ${employee.id})`;
    await seedUsers();
  });

  afterAll(async () => {
    await sql`DELETE FROM wfh_change_request_dates`;
    await sql`DELETE FROM wfh_change_requests`;
    await sql`DELETE FROM work_from_home_days`;
    await sql`DELETE FROM users WHERE id IN (${admin.id}, ${coordinator.id}, ${employee.id})`;
    await sql.end();
  });

  it("creates a pending additional request for an employee", async () => {
    const result = await createWfhRequest(employee, {
      kind: "additional",
      requestedDates: ["2099-01-05"],
      replacedDates: [],
      comment: "Necesito trabajar desde casa por una cita médica.",
    });

    expect(result).toMatchObject({ ok: true });
    const rows = await sql`SELECT requester_id, coordinator_id, kind, status, requester_comment FROM wfh_change_requests`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requester_id: employee.id, coordinator_id: null, kind: "additional", status: "pending" });
  });

  it("allows a coordinator to create an own pending request without putting it in the team queue", async () => {
    const result = await createWfhRequest(coordinator, {
      kind: "additional",
      requestedDates: ["2099-01-05"],
      replacedDates: [],
      comment: "Necesito solicitar este día.",
    });

    expect(result.ok).toBe(true);
    const rows = await sql`SELECT requester_id, coordinator_id, status FROM wfh_change_requests`;
    expect(rows[0]).toMatchObject({ requester_id: coordinator.id, coordinator_id: coordinator.id, status: "pending" });
  });

  it("rejects a duplicate pending date and cancels the last active date", async () => {
    const input = { kind: "additional" as const, requestedDates: ["2099-01-05"], replacedDates: [], comment: "Motivo suficiente." };
    expect((await createWfhRequest(employee, input)).ok).toBe(true);
    expect((await createWfhRequest(employee, input)).error).toContain("Ya existe");

    const dates = await sql`SELECT r.id AS request_id, d.id AS date_id FROM wfh_change_requests r JOIN wfh_change_request_dates d ON d.request_id = r.id`;
    const cancelled = await cancelWfhRequestDate(employee, String(dates[0].request_id), String(dates[0].date_id));
    expect(cancelled).toMatchObject({ ok: true });

    const rows = await sql`SELECT status FROM wfh_change_requests`;
    expect(rows[0].status).toBe("cancelled");
  });

  it("enforces the request tables and notification columns after migration", async () => {
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'wfh_change_requests'
        AND column_name IN ('admin_notified_at', 'admin_acknowledged_at')
      ORDER BY column_name
    `;
    expect(columns.map((row) => row.column_name)).toEqual(["admin_acknowledged_at", "admin_notified_at"]);
  });
});
