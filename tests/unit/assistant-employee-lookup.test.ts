import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findAllUsers: vi.fn(), filterVisibleStaff: vi.fn(), resolveUserIdentities: vi.fn() }));
vi.mock("@/lib/users/user-repository", () => ({ findAllUsers: mocks.findAllUsers }));
vi.mock("@/lib/employees/staff-service", () => ({ filterVisibleStaff: mocks.filterVisibleStaff }));
vi.mock("@/lib/employees/identity-service", () => ({ resolveUserIdentities: mocks.resolveUserIdentities }));

describe("assistant employee lookup", () => {
  it("filters coordinator searches to the coordinator team and ignores accents", async () => {
    const employee = { id: "employee-1", oracleEmpId: 1, fallbackName: null, fallbackEmail: null };
    mocks.findAllUsers.mockResolvedValue([employee]);
    mocks.filterVisibleStaff.mockImplementation((users: unknown[]) => users);
    mocks.resolveUserIdentities.mockResolvedValue(new Map([["employee-1", { name: "Ignacio Vera", email: "ignacio@example.com", wdNumber: null }]]));
    const { resolveEmployeeByName } = await import("@/lib/assistant/employee-lookup");

    const result = await resolveEmployeeByName({ id: "coordinator-1", name: "Coord", email: "coord@example.com", role: "coordinator" }, "ignacio");

    expect(mocks.findAllUsers).toHaveBeenCalledOnce();
    expect(result.matches).toEqual([{ id: "employee-1", name: "Ignacio Vera", email: "ignacio@example.com" }]);
  });
});
