import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminUsersPage } from "@/lib/users/admin-users-service";

type AdminUsersPageProps = {
  searchParams?: Promise<{ page?: string | string[]; query?: string | string[] }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const queryParam = typeof params?.query === "string" ? params.query.trim() : "";
  const requestedPage = typeof params?.page === "string" ? params.page : undefined;
  const admin = await requireAdmin();
  const { page, totalPages, totalUsers, users } = await getAdminUsersPage(queryParam, requestedPage);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Gestión de usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
           La identidad, los roles y la jerarquía se gestionan en TimerTask. Aquí administras opciones de teletrabajo.
        </p>
      </div>

        <UsersTable currentUserId={admin.id} page={page} query={queryParam} totalPages={totalPages} totalUsers={totalUsers} users={users} />
    </section>
  );
}
