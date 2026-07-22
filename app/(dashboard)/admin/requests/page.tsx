import { AdminRequestList } from "@/components/requests/request-list";
import { RequestFilters } from "@/components/requests/request-filters";
import { requireAdmin } from "@/lib/auth/guards";
import { type RequestDateFilter } from "@/lib/calendar/dates";
import { getRequestsForAdmin, type RequestFilters as RequestFilterValues, type RequestStatusFilter } from "@/lib/requests/request-service";

type AdminRequestsPageProps = {
  searchParams?: Promise<{ date?: string; status?: string }>;
};

function parseFilters(params?: { date?: string; status?: string }): RequestFilterValues {
  const date = params?.date === "month" || params?.date === "week" ? params.date : "all";
  const status = params?.status === "accepted" || params?.status === "rejected" || params?.status === "cancelled" ? params.status : "pending";
  return { date: date as RequestDateFilter, status: status as RequestStatusFilter };
}

export default async function AdminRequestsPage({ searchParams }: AdminRequestsPageProps) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const requests = await getRequestsForAdmin(filters);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Administración</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Solicitudes de días adicionales</h1>
        <p className="mt-2 text-sm text-zinc-600">Aprueba o rechaza las solicitudes pendientes de los empleados.</p>
      </div>
      <RequestFilters {...filters} />
      <AdminRequestList filtered={filters.date !== "all" || filters.status !== "pending"} filters={filters} initialPage={requests} />
    </section>
  );
}
