import { redirect } from "next/navigation";
import { RequestFilters } from "@/components/requests/request-filters";
import { CoordinatorOwnRequestList, CoordinatorRequestList, RequesterRequestList } from "@/components/requests/request-list";
import { requireUser } from "@/lib/auth/guards";
import { getRequestsForCoordinator, getRequestsForRequester } from "@/lib/requests/request-service";
import { parseRequestFilters } from "@/lib/requests/request-filters";

type RequestsPageProps = {
  searchParams?: Promise<{ date?: string; status?: string }>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const user = await requireUser();
  const filters = parseRequestFilters(await searchParams);

  if (user.role === "admin") {
    redirect("/admin/requests");
  }

  if (user.role === "coordinator") {
     const [requests, ownRequests] = await Promise.all([getRequestsForCoordinator(user.id, filters), getRequestsForRequester(user.id, filters)]);
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Gestión</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Solicitudes de teletrabajo</h1>
          <p className="mt-2 text-sm text-zinc-600">Revisa y decide las solicitudes de tu equipo.</p>
        </div>
         <RequestFilters {...filters} />
          <h2 className="text-xl font-semibold text-zinc-950">Mis solicitudes</h2>
          <CoordinatorOwnRequestList filtered={filters.date !== "all" || filters.status !== "all"} initialPage={ownRequests} filters={filters} />
          <h2 className="pt-4 text-xl font-semibold text-zinc-950">Solicitudes del equipo</h2>
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
