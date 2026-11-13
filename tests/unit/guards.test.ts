import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  isSessionRevoked: vi.fn(),
  getUserById: vi.fn(),
  resolveUserRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("@/lib/users/user-service", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/lib/employees/org-service", () => ({ resolveUserRole: mocks.resolveUserRole }));
vi.mock("@/lib/auth/session", () => ({ readSession: mocks.readSession }));
vi.mock("@/lib/auth/session-repository", () => ({ isSessionRevoked: mocks.isSessionRevoked }));

import { getAuthorizedUser, requireAdmin, requireAuthorizedUser, requireCoordinator } from "@/lib/auth/guards";

const session = (role: string, id = "user-1") => ({ jti: "jti-1", user: { id, name: "User", email: "user@example.com", role } });

describe("authorization guards", () => {
  beforeEach(() => {
    mocks.isSessionRevoked.mockReset().mockResolvedValue(false);
  });

  it("re-resolves the signed role from the current database user", async () => {
    mocks.readSession.mockResolvedValue(session("admin"));
    mocks.getUserById.mockResolvedValue({ id: "user-1", oracleEmpId: 500 });
    mocks.resolveUserRole.mockResolvedValue("employee");

    await expect(getAuthorizedUser()).resolves.toMatchObject({ id: "user-1", role: "employee" });
    expect(mocks.resolveUserRole).toHaveBeenCalledWith({ id: "user-1", oracleEmpId: 500 });
  });

  it("rejects a session whose database user no longer exists", async () => {
    mocks.readSession.mockResolvedValue(session("admin", "deleted"));
    mocks.getUserById.mockResolvedValue(null);

    await expect(getAuthorizedUser()).resolves.toBeNull();
  });

  it("rejects a revoked session and looks the user up in parallel with the revocation check", async () => {
    mocks.readSession.mockResolvedValue(session("admin"));
    mocks.isSessionRevoked.mockResolvedValue(true);
    mocks.getUserById.mockResolvedValue({ id: "user-1", oracleEmpId: 500 });

    await expect(getAuthorizedUser()).resolves.toBeNull();
    expect(mocks.isSessionRevoked).toHaveBeenCalledWith("jti-1");
    expect(mocks.getUserById).toHaveBeenCalledWith("user-1");
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.readSession.mockResolvedValue(null);

    await expect(requireAuthorizedUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-admins and non-coordinators away from restricted pages", async () => {
    mocks.readSession.mockResolvedValue(session("employee"));
    mocks.getUserById.mockResolvedValue({ id: "user-1", oracleEmpId: null });
    mocks.resolveUserRole.mockResolvedValue("employee");

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/calendar");
    await expect(requireCoordinator()).rejects.toThrow("REDIRECT:/calendar");
  });
});
