import { BulkUserForm } from "@/components/admin/bulk-user-form";
import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/guards";
import { findCoordinators, findUsersForAdmin } from "@/lib/users/user-repository";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const [coordinators, users] = await Promise.all([findCoordinators(), findUsersForAdmin()]);
  const managedUsers = users.map((user) => ({
    canEditAllWfh: user.canEditAllWfh,
    coordinator: user.coordinator,
    coordinatorId: user.coordinatorId,
    email: user.email,
    hasWfh: user.hasWfh,
    id: user.id,
    name: user.name,
    role: user.role,
    wfhDaysAllowance: user.wfhDaysAllowance,
    wdNumber: user.wdNumber,
  }));

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Gestión de usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Administra altas, roles, coordinadores, contraseñas y bajas de usuarios.
        </p>
      </div>

      <UsersTable coordinators={coordinators} currentUserId={admin.id} users={managedUsers} />

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-zinc-950">Alta masiva</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Pega correos separados por saltos de línea, comas o espacios. Se generará una contraseña temporal para cada usuario creado.
          </p>
        </div>
        <BulkUserForm coordinators={coordinators} />
      </div>
    </section>
  );
}
