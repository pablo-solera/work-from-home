import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getUserById: vi.fn(),
  resolveUserRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("@/lib/users/user-service", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/lib/employees/org-service", () => ({ resolveUserRole: mocks.resolveUserRole }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { getAuthorizedUser, requireAdmin, requireAuthorizedUser, requireCoordinator } from "@/lib/auth/guards";

describe("authorization guards", () => {
  it("re-resolves the signed role from the current database user", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", name: "User", email: "user@example.com", role: "admin" });
    mocks.getUserById.mockResolvedValue({ id: "user-1", oracleEmpId: 500 });
    mocks.resolveUserRole.mockResolvedValue("employee");

    await expect(getAuthorizedUser()).resolves.toMatchObject({ id: "user-1", role: "employee" });
    expect(mocks.resolveUserRole).toHaveBeenCalledWith({ id: "user-1", oracleEmpId: 500 });
  });

  it("rejects a session whose database user no longer exists", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "deleted", name: "Deleted", email: "deleted@example.com", role: "admin" });
    mocks.getUserById.mockResolvedValue(null);

    await expect(getAuthorizedUser()).resolves.toBeNull();
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(requireAuthorizedUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-admins and non-coordinators away from restricted pages", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", name: "User", email: "user@example.com", role: "employee" });
    mocks.getUserById.mockResolvedValue({ id: "user-1", oracleEmpId: null });
    mocks.resolveUserRole.mockResolvedValue("employee");

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/calendar");
    await expect(requireCoordinator()).rejects.toThrow("REDIRECT:/calendar");
  });
});
