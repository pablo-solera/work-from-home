import type { ManagedUser } from "@/components/admin/users-table";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { resolveOrganizationForUsers } from "@/lib/employees/org-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findUsersForAdmin } from "@/lib/users/user-repository";

const PAGE_SIZE = 10;
const MAX_QUERY_LENGTH = 120;

type AdminUserRecord = Awaited<ReturnType<typeof findUsersForAdmin>>[number];
type UserIdentity = Awaited<ReturnType<typeof resolveUserIdentities>> extends Map<string, infer Value> ? Value : never;
type OrganizationUser = Awaited<ReturnType<typeof resolveOrganizationForUsers>> extends Map<string, infer Value> ? Value : never;

export type AdminUserListItem = ManagedUser;

export function normalizeAdminUserSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function parseAdminUserPage(value?: string): number {
  if (!value || !/^\d+$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function sortAdminUsers(users: AdminUserListItem[]): AdminUserListItem[] {
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

  return [...users].sort((left, right) => collator.compare(left.name, right.name) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export function matchesAdminUserQuery(user: AdminUserListItem, query: string): boolean {
  if (!query) return true;

  const roleLabels: Record<AdminUserListItem["role"], string> = {
    admin: "Admin",
    coordinator: "Coordinador",
    employee: "Empleado",
  };
  const searchableFields = [
    user.name,
    user.email,
    user.wdNumber,
    roleLabels[user.role],
    user.coordinator?.name,
    user.coordinator?.email,
    user.canEditAllWfh ? "cobertura" : "",
  ];
  const normalizedQuery = normalizeAdminUserSearch(query);

  return searchableFields.some((field) => field && normalizeAdminUserSearch(field).includes(normalizedQuery));
}

function toAdminUser(
  user: AdminUserRecord,
  identity: UserIdentity,
  organizationUser: OrganizationUser | undefined,
  identities: Map<string, UserIdentity>,
): AdminUserListItem {
  const coordinator = organizationUser?.coordinator ?? null;
  const coordinatorIdentity = coordinator ? identities.get(coordinator.id) : null;

  return {
    canEditAllWfh: user.canEditAllWfh,
    coordinator: coordinator && coordinatorIdentity
      ? { id: coordinator.id, name: coordinatorIdentity.name, email: coordinatorIdentity.email ?? "" }
      : null,
    coordinatorId: coordinator?.id ?? null,
    email: identity.email ?? "",
    hasWfh: user.hasWfh,
    id: user.id,
    name: identity.name,
    role: organizationUser?.role ?? "employee",
    wfhDaysAllowance: user.wfhDaysAllowance,
    wdNumber: identity.wdNumber,
  };
}

export async function getAdminUsersPage(query: string, requestedPage?: string) {
  const queryParam = query.trim().slice(0, MAX_QUERY_LENGTH);
  const normalizedQuery = normalizeAdminUserSearch(queryParam);
  const allUsers = await findUsersForAdmin();
  const visibleUsers = await filterVisibleStaff(allUsers, { includeSystemUsers: true });
  const organization = await resolveOrganizationForUsers(visibleUsers);
  const coordinators = [...organization.values()].flatMap((user) => user.coordinator ? [user.coordinator] : []);
  const identities = await resolveUserIdentities([...visibleUsers, ...coordinators]);

  const filteredUsers = sortAdminUsers(visibleUsers
    .map((user) => toAdminUser(user, identities.get(user.id) ?? { name: "Usuario", email: null, wdNumber: null }, organization.get(user.id), identities))
    .filter((user) => matchesAdminUserQuery(user, normalizedQuery)));
  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const page = Math.min(parseAdminUserPage(requestedPage), totalPages);

  return {
    page,
    totalPages,
    totalUsers,
    users: filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}
