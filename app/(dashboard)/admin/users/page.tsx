import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/guards";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findCoordinators, findUsersForAdmin } from "@/lib/users/user-repository";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const [allCoordinators, allUsers] = await Promise.all([findCoordinators(), findUsersForAdmin()]);

  // Only show employees from the configured staff lines. System accounts (admin,
  // etc.) are kept so they can still be managed.
  const [coordinators, users] = await Promise.all([
    filterVisibleStaff(allCoordinators, { includeSystemUsers: true }),
    filterVisibleStaff(allUsers, { includeSystemUsers: true }),
  ]);

  const identities = await resolveUserIdentities([...users, ...coordinators]);

  function identityOf(id: string) {
    return identities.get(id) ?? { name: "Usuario", email: null };
  }

  const coordinatorOptions = coordinators.map((coordinator) => {
    const identity = identityOf(coordinator.id);
    return { id: coordinator.id, name: identity.name, email: identity.email ?? "" };
  });

  const managedUsers = users.map((user) => {
    const identity = identityOf(user.id);
    const coordinatorIdentity = user.coordinator ? identityOf(user.coordinator.id) : null;

    return {
      canEditAllWfh: user.canEditAllWfh,
      coordinator: user.coordinator && coordinatorIdentity ? { id: user.coordinator.id, name: coordinatorIdentity.name, email: coordinatorIdentity.email ?? "" } : null,
      coordinatorId: user.coordinatorId,
      email: identity.email ?? "",
      hasWfh: user.hasWfh,
      id: user.id,
      name: identity.name,
      role: user.role,
      wfhDaysAllowance: user.wfhDaysAllowance,
      wdNumber: user.wdNumber,
    };
  });

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Gestión de usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          La identidad de los empleados (nombre y email) se gestiona en TimerTask. Aquí administras roles, coordinadores, contraseñas y opciones de teletrabajo.
        </p>
      </div>

      <UsersTable coordinators={coordinatorOptions} currentUserId={admin.id} users={managedUsers} />
    </section>
  );
}
