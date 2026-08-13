import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findEmployeeByCoordinatorId: vi.fn(),
  createWorkFromHomeDay: vi.fn(),
  deleteWorkFromHomeDay: vi.fn(),
}));

vi.mock("@/lib/users/user-repository", () => ({ findUserById: mocks.findUserById, findAllUsers: vi.fn(), findUserWorkFromHomeDays: vi.fn(), findAllWorkFromHomeDays: vi.fn(), findWorkFromHomeDaysByUserIds: vi.fn() }));
vi.mock("@/lib/employees/org-service", () => ({ findEmployeeByCoordinatorId: mocks.findEmployeeByCoordinatorId, findEmployeeTeamVisibility: vi.fn(), findExcludedEmpIds: vi.fn(), findUsersForCoordinator: vi.fn() }));
vi.mock("@/lib/employees/identity-service", () => ({ resolveUserIdentities: vi.fn() }));
vi.mock("@/lib/employees/staff-service", () => ({ filterVisibleStaff: vi.fn() }));
vi.mock("@/lib/absences/absence-service", () => ({ createEmptySections: vi.fn(), getAbsenceSectionsByDate: vi.fn() }));
vi.mock("@/lib/requests/request-service", () => ({ getPendingRequestedDates: vi.fn() }));
vi.mock("@/lib/calendar/calendar-repository", () => ({ createWorkFromHomeDay: mocks.createWorkFromHomeDay, deleteWorkFromHomeDay: mocks.deleteWorkFromHomeDay, findAllWorkFromHomeDays: vi.fn(), findUserWorkFromHomeDays: vi.fn(), findWorkFromHomeDaysByUserIds: vi.fn(), replaceWorkFromHomeDays: vi.fn() }));

import { assertCanEditWorkFromHomeDays, getMinimumEditableDate, setWorkFromHomeDay } from "@/lib/calendar/calendar-service";

describe("calendar business rules", () => {
  it("allows only admins to edit dates before today", () => {
    expect(getMinimumEditableDate("admin")).toBeUndefined();
    expect(getMinimumEditableDate("coordinator")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getMinimumEditableDate("employee")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("allows a coordinator with the broad flag to edit another user", async () => {
    mocks.findUserById.mockResolvedValue({ id: "coordinator", canEditAllWfh: true });

    await expect(assertCanEditWorkFromHomeDays({ id: "coordinator", name: "Coordinator", email: "c@example.com", role: "coordinator" }, "employee")).resolves.toBeUndefined();
    expect(mocks.findEmployeeByCoordinatorId).not.toHaveBeenCalled();
  });

  it("rejects a coordinator editing an employee outside their team", async () => {
    mocks.findUserById.mockResolvedValue({ id: "coordinator", canEditAllWfh: false });
    mocks.findEmployeeByCoordinatorId.mockResolvedValue(null);

    await expect(assertCanEditWorkFromHomeDays({ id: "coordinator", name: "Coordinator", email: "c@example.com", role: "coordinator" }, "employee")).rejects.toThrow("not assigned");
  });

  it("rejects invalid, weekend and holiday dates on the server", async () => {
    await expect(setWorkFromHomeDay("user-1", "invalid", true)).rejects.toThrow("Invalid date");
    await expect(setWorkFromHomeDay("user-1", "2026-08-08", true)).rejects.toThrow("Weekend");
    await expect(setWorkFromHomeDay("user-1", "2026-05-15", true)).rejects.toThrow("Holiday");
    expect(mocks.createWorkFromHomeDay).not.toHaveBeenCalled();
  });
});
