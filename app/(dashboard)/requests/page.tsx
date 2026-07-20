import { redirect } from "next/navigation";
import { RequestFilters } from "@/components/requests/request-filters";
import { CoordinatorRequestList, RequesterRequestList } from "@/components/requests/request-list";
import { requireUser } from "@/lib/auth/guards";
import { type RequestDateFilter } from "@/lib/calendar/dates";
import { getRequestsForCoordinator, getRequestsForRequester, type RequestFilters as RequestFilterValues, type RequestStatusFilter } from "@/lib/requests/request-service";

type RequestsPageProps = {
  searchParams?: Promise<{ date?: string; status?: string }>;
};

function parseFilters(params?: { date?: string; status?: string }): RequestFilterValues {
  const date = params?.date === "month" || params?.date === "week" ? params.date : "all";
  const status = params?.status === "pending" || params?.status === "accepted" || params?.status === "rejected" || params?.status === "cancelled" ? params.status : "all";
  return { date: date as RequestDateFilter, status: status as RequestStatusFilter };
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const user = await requireUser();
  const filters = parseFilters(await searchParams);

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role === "coordinator") {
     const requests = await getRequestsForCoordinator(user.id, filters);
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Gestión</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Solicitudes de teletrabajo</h1>
          <p className="mt-2 text-sm text-zinc-600">Revisa y decide las solicitudes de tu equipo.</p>
        </div>
        <RequestFilters {...filters} />
         <CoordinatorRequestList filtered={filters.date !== "all" || filters.status !== "all"} initialPage={requests} filters={filters} />
      </section>
    );
  }

  const requests = await getRequestsForRequester(user.id, filters);
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Teletrabajo</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Mis solicitudes</h1>
        <p className="mt-2 text-sm text-zinc-600">Consulta el estado de tus solicitudes. Puedes crear nuevas solicitudes desde tu calendario.</p>
      </div>
      <RequestFilters {...filters} />
       <RequesterRequestList filtered={filters.date !== "all" || filters.status !== "all"} initialPage={requests} filters={filters} />
    </section>
  );
}
