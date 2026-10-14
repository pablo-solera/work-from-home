import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminUsersPage: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/users/admin-users-service", () => ({ getAdminUsersPage: mocks.getAdminUsersPage }));
vi.mock("@/components/admin/users-table", () => ({ UsersTable: function MockUsersTable() { return null; } }));

import AdminUsersPage from "@/app/(dashboard)/admin/users/page";

function findUsersTable(node: unknown): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const element = node as { type?: { name?: string }; props?: { children?: unknown } };
  if (element.type?.name === "MockUsersTable") return { props: element.props as Record<string, unknown> };
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findUsersTable(child);
      if (found) return found;
    }
  }
  return findUsersTable(children);
}

describe("admin users page", () => {
  it("requires an admin and passes the service's clamped page results to the table", async () => {
    const users = [{ id: "u1", name: "Usuario" }];
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.getAdminUsersPage.mockResolvedValue({ page: 2, totalPages: 2, totalUsers: 11, users });

    const page = await AdminUsersPage({ searchParams: Promise.resolve({ page: "99", query: "  persona  " }) });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.getAdminUsersPage).toHaveBeenCalledWith("persona", "99");
    expect(findUsersTable(page)?.props).toMatchObject({
      currentUserId: "admin-1",
      page: 2,
      query: "persona",
      totalPages: 2,
      totalUsers: 11,
      users,
    });
  });

  it("ignores repeated query parameters rather than treating arrays as strings", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.getAdminUsersPage.mockResolvedValue({ page: 1, totalPages: 1, totalUsers: 0, users: [] });

    await AdminUsersPage({ searchParams: Promise.resolve({ page: ["2", "3"], query: ["first", "second"] }) });

    expect(mocks.getAdminUsersPage).toHaveBeenCalledWith("", undefined);
  });
});
