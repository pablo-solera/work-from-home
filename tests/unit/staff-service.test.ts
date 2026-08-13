import { describe, expect, it, vi } from "vitest";

const findStaffEmpIds = vi.hoisted(() => vi.fn());
vi.mock("@/lib/employees/org-service", () => ({ findStaffEmpIds }));

import { filterVisibleStaff } from "@/lib/employees/staff-service";

describe("visible staff rules", () => {
  const users = [
    { id: "staff", oracleEmpId: 100 },
    { id: "other", oracleEmpId: 200 },
    { id: "system", oracleEmpId: null },
  ];

  it("keeps only configured staff and excludes system users by default", async () => {
    findStaffEmpIds.mockResolvedValue(new Set([100]));

    await expect(filterVisibleStaff(users)).resolves.toEqual([users[0]]);
  });

  it("includes system users only when explicitly requested", async () => {
    findStaffEmpIds.mockResolvedValue(new Set([100]));

    await expect(filterVisibleStaff(users, { includeSystemUsers: true })).resolves.toEqual([users[0], users[2]]);
  });

  it("keeps mapped users when Oracle staff lookup fails, without system users", async () => {
    findStaffEmpIds.mockRejectedValue(new Error("Oracle unavailable"));

    await expect(filterVisibleStaff(users)).resolves.toEqual([users[0], users[1]]);
  });
});
