import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getVisibleAssistantEmployeeRecords: vi.fn(), findWorkFromHomeDaysByUserIds: vi.fn(), getAbsenceSectionsByDate: vi.fn() }));
vi.mock("@/lib/assistant/employee-lookup", () => ({ getVisibleAssistantEmployeeRecords: mocks.getVisibleAssistantEmployeeRecords }));
vi.mock("@/lib/calendar/calendar-repository", () => ({ findWorkFromHomeDaysByUserIds: mocks.findWorkFromHomeDaysByUserIds }));
vi.mock("@/lib/absences/absence-service", () => ({ getAbsenceSectionsByDate: mocks.getAbsenceSectionsByDate }));

describe("assistant day status", () => {
  it("returns teletrabajo when the visible employee has a WFH entry", async () => {
    mocks.getVisibleAssistantEmployeeRecords.mockResolvedValue([{ id: "employee-1", name: "Ignacio Vera", email: "ignacio@example.com", oracleEmpId: 1 }]);
    mocks.findWorkFromHomeDaysByUserIds.mockResolvedValue([{ date: "2026-08-20" }]);
    mocks.getAbsenceSectionsByDate.mockResolvedValue({});
    const { getEmployeeDayStatus } = await import("@/lib/assistant/day-status");

    const result = await getEmployeeDayStatus({ id: "coordinator-1", name: "Coord", email: "coord@example.com", role: "coordinator" }, "employee-1", "2026-08-20");

    expect(result).toMatchObject({ status: "teletrabajo", employee: { name: "Ignacio Vera" } });
  });

  it("does not allow an employee outside the visible scope", async () => {
    mocks.getVisibleAssistantEmployeeRecords.mockResolvedValue([]);
    const { getEmployeeDayStatus } = await import("@/lib/assistant/day-status");

    const result = await getEmployeeDayStatus({ id: "coordinator-1", name: "Coord", email: "coord@example.com", role: "coordinator" }, "employee-2", "2026-08-20");

    expect(result).toEqual({ error: "Ese empleado no está dentro de tu ámbito de consulta." });
  });

  it("returns every day in a range with server-generated date labels", async () => {
    mocks.getVisibleAssistantEmployeeRecords.mockResolvedValue([{ id: "employee-1", name: "Ignacio Vera", email: "ignacio@example.com", oracleEmpId: 1 }]);
    mocks.findWorkFromHomeDaysByUserIds.mockResolvedValue([{ date: "2026-09-18" }]);
    mocks.getAbsenceSectionsByDate.mockResolvedValue({});
    const { getEmployeeRangeStatus } = await import("@/lib/assistant/day-status");

    const result = await getEmployeeRangeStatus({ id: "coordinator-1", name: "Coord", email: "coord@example.com", role: "coordinator" }, "employee-1", "2026-09-17", "2026-09-18");

    expect(result).toMatchObject({ statuses: [{ date: "2026-09-17", status: "en oficina" }, { date: "2026-09-18", status: "teletrabajo", label: "viernes, 18 de septiembre de 2026" }] });
  });
});
