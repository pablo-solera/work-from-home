import { AdminRequestList } from "@/components/requests/request-list";
import { RequestFilters } from "@/components/requests/request-filters";
import { requireAdmin } from "@/lib/auth/guards";
import { getRequestsForAdmin } from "@/lib/requests/request-service";
import { parseRequestFilters } from "@/lib/requests/request-filters";

type AdminRequestsPageProps = {
  searchParams?: Promise<{ date?: string; status?: string }>;
};

export default async function AdminRequestsPage({ searchParams }: AdminRequestsPageProps) {
  await requireAdmin();
  const filters = parseRequestFilters(await searchParams, "pending");
  const requests = await getRequestsForAdmin(filters);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Administración</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Solicitudes de días adicionales</h1>
        <p className="mt-2 text-sm text-zinc-600">Aprueba o rechaza las solicitudes pendientes de los empleados.</p>
      </div>
      <RequestFilters defaultStatus="pending" {...filters} />
      <AdminRequestList filtered={filters.date !== "all" || filters.status !== "pending"} filters={filters} initialPage={requests} />
    </section>
  );
}
