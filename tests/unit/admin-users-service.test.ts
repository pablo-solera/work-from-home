import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUsersForAdmin: vi.fn(),
  filterVisibleStaff: vi.fn(),
  resolveOrganizationForUsers: vi.fn(),
  resolveUserIdentities: vi.fn(),
}));

vi.mock("@/lib/users/user-repository", () => ({ findUsersForAdmin: mocks.findUsersForAdmin }));
vi.mock("@/lib/employees/staff-service", () => ({ filterVisibleStaff: mocks.filterVisibleStaff }));
vi.mock("@/lib/employees/org-service", () => ({ resolveOrganizationForUsers: mocks.resolveOrganizationForUsers }));
vi.mock("@/lib/employees/identity-service", () => ({ resolveUserIdentities: mocks.resolveUserIdentities }));

import type { ManagedUser } from "@/components/admin/users-table";
import {
  getAdminUsersPage,
  matchesAdminUserQuery,
  normalizeAdminUserSearch,
  parseAdminUserPage,
  sortAdminUsers,
} from "@/lib/users/admin-users-service";

type UserRecord = {
  canEditAllWfh: boolean;
  createdAt: Date;
  fallbackEmail: string | null;
  fallbackName: string | null;
  hasWfh: boolean | null;
  id: string;
  oracleEmpId: number | null;
  wfhDaysAllowance: number | null;
};

function managedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    canEditAllWfh: false,
    coordinator: null,
    coordinatorId: null,
    email: "",
    hasWfh: null,
    id: "user",
    name: "Usuario",
    role: "employee",
    wfhDaysAllowance: null,
    wdNumber: null,
    ...overrides,
  };
}

function userRecord(id: string, oracleEmpId: number | null): UserRecord {
  return {
    canEditAllWfh: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    fallbackEmail: null,
    fallbackName: null,
    hasWfh: null,
    id,
    oracleEmpId,
    wfhDaysAllowance: null,
  };
}

function setup(records: UserRecord[], resolvedUsers: ManagedUser[]) {
  mocks.findUsersForAdmin.mockResolvedValue(records);
  mocks.filterVisibleStaff.mockImplementation(async (users: UserRecord[]) => users);
  const identityEntries = resolvedUsers.flatMap((user) => [
    [user.id, { name: user.name, email: user.email, wdNumber: user.wdNumber }] as const,
    ...(user.coordinator ? [[user.coordinator.id, { name: user.coordinator.name, email: user.coordinator.email, wdNumber: null }] as const] : []),
  ]);
  const identities = new Map(identityEntries);
  mocks.resolveUserIdentities.mockResolvedValue(identities);
  mocks.resolveOrganizationForUsers.mockImplementation(async (users: UserRecord[]) => new Map(users.map((user) => {
    const resolved = resolvedUsers.find((candidate) => candidate.id === user.id);
    return [user.id, { coordinator: resolved?.coordinator ? { ...userRecord(resolved.coordinator.id, null), ...resolved.coordinator } : null, id: user.id, role: resolved?.role ?? "employee" }];
  })));
}

afterEach(() => vi.resetAllMocks());

describe("admin user list behavior", () => {
  it("normalizes accents and parses only positive integer pages", () => {
    expect(normalizeAdminUserSearch("  ÁLVARO  ")).toBe("alvaro");
    expect([undefined, "", "abc", "0", "-3", "2.5", "1x", "9007199254740992"].map(parseAdminUserPage)).toEqual(Array(8).fill(1));
    expect(parseAdminUserPage("12")).toBe(12);
  });

  it("sorts Spanish names alphabetically with a stable id tie-breaker", () => {
    const sorted = sortAdminUsers([
      managedUser({ id: "b", name: "alvaro" }),
      managedUser({ id: "z", name: "Álvaro" }),
      managedUser({ id: "a", name: "Álvaro" }),
      managedUser({ id: "c", name: "Beatriz" }),
    ]);

    expect(sorted.map((user) => user.id)).toEqual(["a", "b", "z", "c"]);
  });

  it("searches accent-insensitively across identity, role, coordinator, WD and coverage", () => {
    const coordinator = { id: "coordinator", name: "Álvaro Núñez", email: "alvaro@example.com" };
    const user = managedUser({
      canEditAllWfh: true,
      coordinator,
      email: "empleada@example.com",
      name: "Bárbara Pérez",
      role: "coordinator",
      wdNumber: "WD-123",
    });

    for (const query of ["barbara", "EMPLEADA@", "coordinador", "alvaro", "alvaro@example", "wd-123", "cobertura"]) {
      expect(matchesAdminUserQuery(user, query), query).toBe(true);
    }
    expect(matchesAdminUserQuery(user, "administrador")).toBe(false);
  });

  it("paginates the app's visible users in stable pages, clamps the page, and counts only matches", async () => {
    const records = Array.from({ length: 25 }, (_, index) => userRecord(`u${index + 1}`, index + 1));
    const users = records.map((record, index) => managedUser({ id: record.id, name: `Empleado ${String(index + 1).padStart(2, "0")}` }));
    setup(records, users);

    const first = await getAdminUsersPage("", "1");
    const second = await getAdminUsersPage("", "2");
    const last = await getAdminUsersPage("", "99");
    const allPageIds = [...first.users, ...second.users, ...last.users].map((user) => user.id);

    expect([first.users.length, second.users.length, last.users.length]).toEqual([10, 10, 5]);
    expect([first.totalUsers, first.totalPages, last.page]).toEqual([25, 3, 3]);
    expect(new Set(allPageIds).size).toBe(25);
    expect(mocks.filterVisibleStaff).toHaveBeenCalledWith(records, { includeSystemUsers: true });
  });

  it("filters before pagination and includes the coordinator identity in the lookup batch", async () => {
    const records = Array.from({ length: 12 }, (_, index) => userRecord(`u${index + 1}`, index + 1));
    const coordinator = { id: "coord-1", name: "Coordinador", email: "coord@example.com" };
    const users = records.map((record, index) => managedUser({
      coordinator: index === 10 ? coordinator : null,
      id: record.id,
      name: index < 11 ? `Resultado ${index}` : "Otro",
    }));
    setup(records, users);

    const result = await getAdminUsersPage(" resultado ", "2");

    expect(result).toMatchObject({ page: 2, totalPages: 2, totalUsers: 11 });
    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.coordinator).toEqual(coordinator);
    expect(mocks.resolveUserIdentities).toHaveBeenCalledOnce();
    expect(mocks.resolveUserIdentities.mock.calls[0]?.[0]).toContainEqual(expect.objectContaining({ id: coordinator.id }));
  });

  it("returns one empty page when no app users match", async () => {
    setup([], []);

    await expect(getAdminUsersPage("missing", "8")).resolves.toEqual({ page: 1, totalPages: 1, totalUsers: 0, users: [] });
  });
});
