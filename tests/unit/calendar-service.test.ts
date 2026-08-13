import { describe, expect, it } from "vitest";
import { assertCanEditWorkFromHomeDays, buildDaySummaries, buildSectionsByDate } from "@/lib/calendar/calendar-service";
import { getCalendarDays } from "@/lib/calendar/dates";

const identities = new Map([
  ["office", { name: "Ana Oficina", email: "ana@example.com", wdNumber: null }],
  ["remote", { name: "Bea Remota", email: "bea@example.com", wdNumber: null }],
  ["excluded", { name: "Cris Excluida", email: "cris@example.com", wdNumber: null }],
]);

const users = [
  { id: "office", oracleEmpId: 1, fallbackName: null, fallbackEmail: null },
  { id: "remote", oracleEmpId: 2, fallbackName: null, fallbackEmail: null },
  { id: "excluded", oracleEmpId: 3, fallbackName: null, fallbackEmail: null },
];

describe("calendar service", () => {
  it("keeps excluded employees in No comprende and out of all counts", () => {
    const date = "2026-08-03";
    const calendar = getCalendarDays(2026, 8);
    const sectionsByDate = buildSectionsByDate(
      [{ date, userId: "remote" }, { date, userId: "excluded" }],
      users,
      identities,
      {},
      calendar,
      new Set([3]),
    );

    const sections = sectionsByDate[date];
    expect(sections.noComprende.map((entry) => entry.userId)).toEqual(["excluded"]);
    expect(sections.teletrabajo.map((entry) => entry.userId)).toEqual(["remote"]);
    expect(sections.enOficina.map((entry) => entry.userId)).toEqual(["office"]);

    const summary = buildDaySummaries(sectionsByDate, calendar)[date];
    expect(summary).toMatchObject({ absenceCount: 0, officeCount: 1, remoteCount: 1 });
  });

  it("does not count an employee as teleworking and in the office when absent", () => {
    const date = "2026-08-03";
    const calendar = getCalendarDays(2026, 8);
    const sectionsByDate = buildSectionsByDate(
      [{ date, userId: "remote" }],
      users,
      identities,
      { [date]: { vacaciones: [{ userId: "remote", userName: "Bea Remota", userEmail: "bea@example.com" }] } },
      calendar,
      new Set([3]),
    );

    expect(sectionsByDate[date].teletrabajo).toHaveLength(0);
    expect(sectionsByDate[date].enOficina.map((entry) => entry.userId)).toEqual(["office"]);
  });

  it("hides calendar data outside the visible date range", () => {
    const calendar = getCalendarDays(2026, 8);
    const date = "2026-08-20";
    const sectionsByDate = buildSectionsByDate(
      [{ date, userId: "remote" }],
      users,
      identities,
      {},
      calendar,
      new Set(),
      "2026-08-01",
      "2026-08-19",
    );

    expect(sectionsByDate[date]).toBeUndefined();
    expect(buildDaySummaries(sectionsByDate, calendar, "2026-08-01", "2026-08-19")[date]).toMatchObject({ isOutOfRange: true, officeCount: 0, remoteCount: 0 });
  });

  it("rejects employees before checking the broad calendar-edit flag", async () => {
    await expect(assertCanEditWorkFromHomeDays({
      email: "employee@example.com",
      id: "employee",
      name: "Empleado",
      role: "employee",
    }, "another-user")).rejects.toThrow("Employees cannot update work-from-home days");
  });

});
