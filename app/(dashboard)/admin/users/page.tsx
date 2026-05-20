import { BulkUserForm } from "@/components/admin/bulk-user-form";
import { requireAdmin } from "@/lib/auth/guards";
import { findCoordinators } from "@/lib/users/user-repository";

export default async function AdminUsersPage() {
  await requireAdmin();
  const coordinators = await findCoordinators();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Crear usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Pega correos separados por saltos de línea, comas o espacios. Se generará una contraseña temporal para cada usuario creado.
        </p>
      </div>
      <BulkUserForm coordinators={coordinators} />
    </section>
  );
}
