import { SyncUsersButton } from "@/components/admin/sync-users-button";
import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/common/page-header";
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
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader>
          <PageHeader.Title>Gestión de usuarios</PageHeader.Title>
          <PageHeader.Description>La identidad, los roles y la jerarquía se gestionan en TimerTask. Aquí administras opciones de teletrabajo.</PageHeader.Description>
        </PageHeader>
        <SyncUsersButton />
      </div>

      <UsersTable currentUserId={admin.id} page={page} query={queryParam} totalPages={totalPages} totalUsers={totalUsers} users={users} />
    </section>
  );
}
