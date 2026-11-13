import { redirect } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { RequestFilters } from "@/components/requests/request-filters";
import { CoordinatorOwnRequestList, CoordinatorRequestList, RequesterRequestList } from "@/components/requests/request-list";
import { RequestViewTabs } from "@/components/requests/request-view-tabs";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getRequestNotificationSummary, getRequestsForCoordinator, getRequestsForRequester } from "@/lib/requests/request-service";
import { createRequestViewHref, parseRequestFilters, parseRequestView } from "@/lib/requests/request-filters";

type RequestsPageProps = {
  searchParams?: Promise<{ date?: string; status?: string; view?: string }>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const user = await requireAuthorizedUser();
  const filters = parseRequestFilters(await searchParams);

  if (user.role === "admin") {
    redirect("/admin/requests");
  }

  if (user.role === "coordinator") {
    const params = await searchParams;
    const view = parseRequestView(params, ["team", "own"] as const, "team");
    const [requests, notificationSummary] = await Promise.all([
      view === "team" ? getRequestsForCoordinator(user.id, filters) : getRequestsForRequester(user.id, filters),
      getRequestNotificationSummary(user.id, "coordinator"),
    ]);
    const teamHref = createRequestViewHref("/requests", filters, "team", "team");
    const ownHref = createRequestViewHref("/requests", filters, "own", "team");

    return (
      <section className="space-y-6">
        <PageHeader>
          <PageHeader.Title>Solicitudes de teletrabajo</PageHeader.Title>
          <PageHeader.Description>Revisa y decide las solicitudes de tu equipo.</PageHeader.Description>
        </PageHeader>
          <RequestViewTabs ariaLabel="Ámbito de solicitudes" tabs={[
            { active: view === "team", count: notificationSummary?.informationalRequestCount, href: teamHref, label: "Solicitudes del equipo" },
            { active: view === "own", href: ownHref, label: "Mis solicitudes" },
          ]} />
          <RequestFilters {...filters} />
          {view === "team" ? <CoordinatorRequestList filtered={filters.date !== "all" || filters.status !== "all"} initialPage={requests} filters={filters} /> : <CoordinatorOwnRequestList filtered={filters.date !== "all" || filters.status !== "all"} initialPage={requests} filters={filters} />}
       </section>
     );
  }

  const requests = await getRequestsForRequester(user.id, filters);
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeader.Title>Mis solicitudes</PageHeader.Title>
        <PageHeader.Description>Consulta el estado de tus solicitudes. Puedes crear nuevas solicitudes desde tu calendario.</PageHeader.Description>
      </PageHeader>
      <RequestFilters {...filters} />
       <RequesterRequestList filtered={filters.date !== "all" || filters.status !== "all"} initialPage={requests} filters={filters} />
    </section>
  );
}
