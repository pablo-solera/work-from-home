import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyUserSync: vi.fn(),
  countWorkFromHomeDaysByUserIds: vi.fn(),
  findAllActiveEmployees: vi.fn(),
  findUsersWithOracleEmpId: vi.fn(),
  getTestAccountEmpIds: vi.fn(),
}));

vi.mock("@/lib/employees/employee-repository", () => ({ findAllActiveEmployees: mocks.findAllActiveEmployees }));
vi.mock("@/lib/employees/test-accounts", () => ({ getTestAccountEmpIds: mocks.getTestAccountEmpIds }));
vi.mock("@/lib/users/user-repository", () => ({
  applyUserSync: mocks.applyUserSync,
  countWorkFromHomeDaysByUserIds: mocks.countWorkFromHomeDaysByUserIds,
  findUsersWithOracleEmpId: mocks.findUsersWithOracleEmpId,
}));

import { buildSyncPlan, runUserSync } from "@/lib/users/sync-service";

describe("user synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAllActiveEmployees.mockResolvedValue([{ empId: 10, name: "Active employee", email: "active@example.com", wdNumber: null }]);
    mocks.findUsersWithOracleEmpId.mockResolvedValue([
      { id: "inactive", oracleEmpId: 20, deactivatedAt: null },
      { id: "returning", oracleEmpId: 10, deactivatedAt: new Date() },
    ]);
    mocks.getTestAccountEmpIds.mockReturnValue(new Set());
    mocks.countWorkFromHomeDaysByUserIds.mockResolvedValue([{ userId: "inactive", count: 3 }]);
    mocks.applyUserSync.mockResolvedValue({ created: [], reactivated: [{ id: "returning" }], deactivated: [{ id: "inactive" }] });
  });

  it("plans deactivation and reactivation without deleting accounts", async () => {
    const plan = await buildSyncPlan();
    expect(plan.toDelete).toEqual([{ userId: "inactive", empId: 20, wfhDays: 3 }]);
    expect(plan.toReactivate).toEqual([{ userId: "returning", empId: 10 }]);
  });

  it("applies one sync plan in a transaction while preserving user history", async () => {
    const plan = await buildSyncPlan();
    const result = await runUserSync(plan);
    expect(mocks.applyUserSync).toHaveBeenCalledWith([], ["returning"], ["inactive"]);
    expect(result).toEqual({ created: 0, deactivated: 1 });
  });
});
