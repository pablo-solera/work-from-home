import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/oracle", () => ({
  getOracleSchema: () => "TIMERTASK_ES",
  queryOracle: vi.fn(async (query: string) => {
    if (query.includes("templeado_dias")) return [];
    if (query.includes("e.emp_id IN")) {
      return [{ EMP_ID: 500, EMP_NOMBRE: "Team Employee", EMP_APELLIDO1: "Test", EMP_APELLIDO2: null, EMP_EMAIL: "team-employee-test@example.com", EMP_TEL1: null }];
    }
    if (query.includes("eg.grupo_id IN")) {
      return [
        { EMP_ID: 220, GROUP_ID: 1024 },
        { EMP_ID: 415, GROUP_ID: 1017 },
      ];
    }

    return [{ EMP_ID: 500, COORDINATOR_EMP_ID: 415 }];
  }),
}));

import {
  cancelWfhRequestDate,
  createWfhRequest,
  decideWfhRequest,
  getAdminSubstitutionNotifications,
  getPendingRequestedDates,
  getRequestNotificationSummary,
  getRequestsForAdmin,
  getRequestsForCoordinator,
  getRequestsForRequester,
  markAdminSubstitutionAsRead,
  markSubstitutionAsRead,
} from "@/lib/requests/request-service";
import type { SessionUser } from "@/lib/auth/session";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");

const sql = postgres(databaseUrl, { max: 2 });

const admin: SessionUser = { id: "00000000-0000-4000-8000-000000000001", name: "Admin Test", email: "admin-test@example.com", role: "admin" };
const coordinator: SessionUser = { id: "00000000-0000-4000-8000-000000000002", name: "Coordinator Test", email: "coordinator-test@example.com", role: "coordinator" };
const employee: SessionUser = { id: "00000000-0000-4000-8000-000000000003", name: "Employee Test", email: "employee-test@example.com", role: "employee" };
const teamEmployee: SessionUser = { id: "00000000-0000-4000-8000-000000000004", name: "Team Employee Test", email: "team-employee-test@example.com", role: "employee" };

async function seedUsers() {
  await sql`
    INSERT INTO users (id, password_hash, fallback_email, fallback_name, oracle_emp_id)
    VALUES
      (${admin.id}, 'test-hash', ${admin.email}, ${admin.name}, 220),
      (${coordinator.id}, 'test-hash', ${coordinator.email}, ${coordinator.name}, 415),
      (${employee.id}, 'test-hash', ${employee.email}, ${employee.name}, NULL),
      (${teamEmployee.id}, 'test-hash', ${teamEmployee.email}, ${teamEmployee.name}, 500)
  `;
}

describe("request persistence on PostgreSQL", () => {
  beforeEach(async () => {
    await sql`DELETE FROM wfh_change_request_dates`;
    await sql`DELETE FROM wfh_change_requests`;
    await sql`DELETE FROM work_from_home_days`;
    await sql`DELETE FROM users WHERE id IN (${admin.id}, ${coordinator.id}, ${employee.id}, ${teamEmployee.id})`;
    await seedUsers();
  });

  afterAll(async () => {
    await sql`DELETE FROM wfh_change_request_dates`;
    await sql`DELETE FROM wfh_change_requests`;
    await sql`DELETE FROM work_from_home_days`;
    await sql`DELETE FROM users WHERE id IN (${admin.id}, ${coordinator.id}, ${employee.id}, ${teamEmployee.id})`;
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

  it("applies a substitution immediately and replaces the original day", async () => {
    await sql`INSERT INTO work_from_home_days (user_id, date) VALUES (${teamEmployee.id}, '2099-01-07')`;

    const result = await createWfhRequest(teamEmployee, {
      kind: "substitution",
      requestedDates: ["2099-01-08"],
      replacedDates: ["2099-01-07"],
      comment: null,
    });

    expect(result).toMatchObject({ ok: true });
    const days = await sql`SELECT date FROM work_from_home_days WHERE user_id = ${teamEmployee.id} ORDER BY date`;
    expect(days.map((row) => row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date))).toEqual(["2099-01-08"]);
  });

  it("rejects a same-day substitution from 10:15 Madrid time", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-05T08:15:00.000Z") });

    try {
      const result = await createWfhRequest(teamEmployee, {
        kind: "substitution",
        requestedDates: ["2026-08-06"],
        replacedDates: ["2026-08-05"],
        comment: null,
      });

      expect(result.error).toBe("Fuera de plazo: después de las 10:15 no se puede seleccionar el día de hoy.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an additional request for today from 10:15 Madrid time", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-05T08:15:00.000Z") });

    try {
      const result = await createWfhRequest(teamEmployee, {
        kind: "additional",
        requestedDates: ["2026-08-05"],
        replacedDates: [],
        comment: "Motivo de prueba.",
      });

      expect(result.error).toBe("Fuera de plazo: después de las 10:15 no se puede seleccionar el día de hoy.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("approves an additional request as an admin and rejects coordinator access", async () => {
    const created = await createWfhRequest(teamEmployee, {
      kind: "additional",
      requestedDates: ["2099-02-03"],
      replacedDates: [],
      comment: "Motivo de prueba.",
    });
    expect(created.ok).toBe(true);

    const [{ id }] = await sql`SELECT id FROM wfh_change_requests WHERE requester_id = ${teamEmployee.id}`;
    expect((await decideWfhRequest(coordinator, String(id), "accepted", null)).error).toContain("permiso");
    expect((await decideWfhRequest(admin, String(id), "accepted", "Aprobada.")).ok).toBe(true);

    const rows = await sql`SELECT status FROM wfh_change_requests WHERE id = ${id}`;
    const days = await sql`SELECT date FROM work_from_home_days WHERE user_id = ${teamEmployee.id}`;
    expect(rows[0].status).toBe("accepted");
    expect(days.map((row) => row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date))).toContain("2099-02-03");
  });

  it("approves a pending substitution for the coordinator team", async () => {
    await sql`INSERT INTO work_from_home_days (user_id, date) VALUES (${teamEmployee.id}, '2099-03-03')`;
    const [{ id: requestId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status)
      VALUES (${teamEmployee.id}, ${coordinator.id}, 'substitution', 'pending')
      RETURNING id
    `;
    const [{ id: dateId }] = await sql`
      INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date)
      VALUES (${requestId}, '2099-03-05', '2099-03-03')
      RETURNING id
    `;

    expect((await decideWfhRequest(coordinator, String(requestId), "accepted", null)).ok).toBe(true);
    const days = await sql`SELECT date FROM work_from_home_days WHERE user_id = ${teamEmployee.id} ORDER BY date`;
    expect(days.map((row) => row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date))).toEqual(["2099-03-05"]);
    expect(dateId).toBeTruthy();
  });

  it("does not resolve the same pending request twice", async () => {
    const [{ id }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, kind, status, requester_comment)
      VALUES (${teamEmployee.id}, 'additional', 'pending', 'Motivo de prueba.')
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date) VALUES (${id}, '2099-04-07')`;

    const results = await Promise.all([
      decideWfhRequest(admin, String(id), "accepted", null),
      decideWfhRequest(admin, String(id), "accepted", null),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => result.error)).toHaveLength(1);
  });

  it("reports notification counts and paginates requester requests", async () => {
    for (const day of ["05", "06", "07", "08", "11", "12", "13", "14", "18", "19", "20"]) {
      expect((await createWfhRequest(teamEmployee, {
        kind: "additional",
        requestedDates: [`2099-05-${day}`],
        replacedDates: [],
        comment: "Motivo de prueba.",
      })).ok).toBe(true);
    }

    const filters = { date: "all" as const, status: "all" as const };
    const firstPage = await getRequestsForRequester(teamEmployee.id, filters);
    expect(firstPage.requests).toHaveLength(10);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await getRequestsForRequester(teamEmployee.id, filters, firstPage.nextCursor ?? undefined);
    expect(secondPage.requests).toHaveLength(1);

    const summary = await getRequestNotificationSummary(coordinator.id, "coordinator");
    expect(summary.informationalRequestCount).toBe(11);
    expect(summary.revision).not.toBeNull();
  });

  it("rejects a cancelled date and a past date", async () => {
    const [{ id: requestId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, kind, status, requester_comment)
      VALUES (${employee.id}, 'additional', 'pending', 'Motivo de prueba.')
      RETURNING id
    `;
    const [{ id: dateId }] = await sql`
      INSERT INTO wfh_change_request_dates (request_id, requested_date)
      VALUES (${requestId}, '2099-06-08')
      RETURNING id
    `;

    expect((await cancelWfhRequestDate(employee, String(requestId), String(dateId))).ok).toBe(true);
    expect((await cancelWfhRequestDate(employee, String(requestId), String(dateId))).error).toContain("Solo se pueden cancelar");

    const [{ id: pastRequestId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, kind, status, requester_comment)
      VALUES (${employee.id}, 'additional', 'pending', 'Motivo de prueba.')
      RETURNING id
    `;
    const [{ id: pastDateId }] = await sql`
      INSERT INTO wfh_change_request_dates (request_id, requested_date)
      VALUES (${pastRequestId}, '2000-01-03')
      RETURNING id
    `;
    expect((await cancelWfhRequestDate(employee, String(pastRequestId), String(pastDateId))).error).toContain("fechas futuras");
  });

  it("lists coordinator requests without including the coordinator own requests", async () => {
    const [{ id: teamRequestId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status, requester_comment)
      VALUES (${teamEmployee.id}, ${coordinator.id}, 'additional', 'pending', 'Solicitud del equipo.')
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date) VALUES (${teamRequestId}, '2099-07-07')`;

    const [{ id: ownRequestId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status, requester_comment)
      VALUES (${coordinator.id}, ${coordinator.id}, 'additional', 'pending', 'Solicitud propia.')
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date) VALUES (${ownRequestId}, '2099-07-08')`;

    const page = await getRequestsForCoordinator(coordinator.id, { date: "all", status: "pending" });
    expect(page.requests.map((request) => request.id)).toEqual([String(teamRequestId)]);
    expect(page.requests[0]).toMatchObject({ requesterName: teamEmployee.name, requesterEmail: teamEmployee.email });
  });

  it("lists only additional requests for admins", async () => {
    const [{ id: additionalId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, kind, status, requester_comment)
      VALUES (${teamEmployee.id}, 'additional', 'pending', 'Solicitud adicional.')
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date) VALUES (${additionalId}, '2099-07-09')`;

    const [{ id: substitutionId }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status, admin_notified_at)
      VALUES (${teamEmployee.id}, ${coordinator.id}, 'substitution', 'accepted', now())
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date) VALUES (${substitutionId}, '2099-07-10', '2099-07-09')`;

    const page = await getRequestsForAdmin({ date: "all", status: "all" });
    expect(page.requests.map((request) => request.id)).toEqual([String(additionalId)]);
  });

  it("lists and acknowledges admin substitution notifications once", async () => {
    const [{ id }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status, admin_notified_at)
      VALUES (${teamEmployee.id}, ${coordinator.id}, 'substitution', 'accepted', now())
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date) VALUES (${id}, '2099-08-04', '2099-08-03')`;

    const page = await getAdminSubstitutionNotifications();
    expect(page.requests.map((request) => request.id)).toContain(String(id));
    expect(await markAdminSubstitutionAsRead(String(id))).toBe(true);
    expect(await markAdminSubstitutionAsRead(String(id))).toBe(false);
  });

  it("acknowledges coordinator substitution notifications once", async () => {
    const [{ id }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status, coordinator_notified_at)
      VALUES (${teamEmployee.id}, ${coordinator.id}, 'substitution', 'accepted', now())
      RETURNING id
    `;
    await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date) VALUES (${id}, '2099-08-11', '2099-08-08')`;

    expect(await markSubstitutionAsRead(coordinator.id, String(id))).toBe(true);
    expect(await markSubstitutionAsRead(coordinator.id, String(id))).toBe(false);
  });

  it("returns active pending requested and replaced dates within the range", async () => {
    const [{ id }] = await sql`
      INSERT INTO wfh_change_requests (requester_id, kind, status)
      VALUES (${teamEmployee.id}, 'substitution', 'pending')
      RETURNING id
    `;
    await sql`
      INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date)
      VALUES (${id}, '2099-09-10', '2099-09-08')
    `;
    await sql`
      INSERT INTO wfh_change_request_dates (request_id, requested_date, replaced_date, cancelled_at)
      VALUES (${id}, '2099-09-11', '2099-09-12', now())
    `;
    await sql`
      INSERT INTO wfh_change_request_dates (request_id, requested_date)
      VALUES (${id}, '2099-10-01')
    `;

    const dates = await getPendingRequestedDates(teamEmployee.id, "2099-09-01", "2099-09-30");
    expect(dates.toSorted()).toEqual(["2099-09-08", "2099-09-10"]);
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
