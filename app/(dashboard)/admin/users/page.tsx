import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/guards";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findUsersForAdmin } from "@/lib/users/user-repository";
import { resolveOrganizationForUsers } from "@/lib/employees/org-service";

type AdminUsersPageProps = {
  searchParams?: Promise<{ page?: string; query?: string }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const queryParam = params?.query?.trim() ?? "";
  const query = queryParam.toLowerCase();
  const requestedPage = Number.parseInt(params?.page ?? "1", 10);
  const admin = await requireAdmin();
  const allUsers = await findUsersForAdmin();

  // Only show employees from the configured staff lines. System accounts (admin,
  // etc.) are kept so they can still be managed. The staff filter and identity
  // resolution both hit Oracle and are independent, so run them together.
  const [users, identities, organization] = await Promise.all([
    filterVisibleStaff(allUsers, { includeSystemUsers: true }),
    resolveUserIdentities(allUsers),
    resolveOrganizationForUsers(allUsers),
  ]);

  function identityOf(id: string) {
    return identities.get(id) ?? { name: "Usuario", email: null, wdNumber: null };
  }

  const allManagedUsers = users.map((user) => {
    const identity = identityOf(user.id);
    const organizationUser = organization.get(user.id);
    const coordinatorIdentity = organizationUser?.coordinator ? identityOf(organizationUser.coordinator.id) : null;

    return {
      canEditAllWfh: user.canEditAllWfh,
      coordinator: organizationUser?.coordinator && coordinatorIdentity ? { id: organizationUser.coordinator.id, name: coordinatorIdentity.name, email: coordinatorIdentity.email ?? "" } : null,
      coordinatorId: organizationUser?.coordinator?.id ?? null,
      email: identity.email ?? "",
      hasWfh: user.hasWfh,
      id: user.id,
      name: identity.name,
      role: organizationUser?.role ?? "employee",
      wfhDaysAllowance: user.wfhDaysAllowance,
      wdNumber: identity.wdNumber,
    };
  });

  const filteredUsers = query
    ? allManagedUsers.filter((user) => [user.name, user.email, user.role, user.coordinator?.name, user.coordinator?.email].filter(Boolean).join(" ").toLowerCase().includes(query))
    : allManagedUsers;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const managedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Gestión de usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
           La identidad, los roles y la jerarquía se gestionan en TimerTask. Aquí administras opciones de teletrabajo.
        </p>
      </div>

        <UsersTable currentUserId={admin.id} page={page} query={queryParam} totalPages={totalPages} totalUsers={filteredUsers.length} users={managedUsers} />
    </section>
  );
}
