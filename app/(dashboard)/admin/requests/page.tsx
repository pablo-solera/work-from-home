import { AdminRequestList, AdminSubstitutionNotificationList } from "@/components/requests/request-list";
import { RequestFilters } from "@/components/requests/request-filters";
import { RequestViewTabs } from "@/components/requests/request-view-tabs";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminSubstitutionNotifications, getRequestNotificationSummary, getRequestsForAdmin } from "@/lib/requests/request-service";
import { createRequestViewHref, parseRequestFilters, parseRequestView } from "@/lib/requests/request-filters";

type AdminRequestsPageProps = {
  searchParams?: Promise<{ date?: string; status?: string; view?: string }>;
};

export default async function AdminRequestsPage({ searchParams }: AdminRequestsPageProps) {
  const user = await requireAdmin();
  const params = await searchParams;
  const filters = parseRequestFilters(params, "pending");
  const view = parseRequestView(params, ["additional", "substitutions"] as const, "additional");
  const [page, notificationSummary] = view === "additional"
    ? await Promise.all([getRequestsForAdmin(filters), getRequestNotificationSummary(user.id, "admin")])
    : await Promise.all([getAdminSubstitutionNotifications(), getRequestNotificationSummary(user.id, "admin")]);
  const additionalHref = createRequestViewHref("/admin/requests", filters, "additional", "additional", "pending");
  const substitutionsHref = createRequestViewHref("/admin/requests", filters, "substitutions", "additional", "pending");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Administración</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Solicitudes</h1>
        <p className="mt-2 text-sm text-zinc-600">{view === "additional" ? "Aprueba o rechaza las solicitudes pendientes de los empleados." : "Revisa las sustituciones notificadas por los coordinadores."}</p>
      </div>
      <RequestViewTabs ariaLabel="Tipo de solicitudes" tabs={[
        { active: view === "additional", count: notificationSummary.actionableRequestCount, href: additionalHref, label: "Días adicionales" },
        { active: view === "substitutions", count: notificationSummary.informationalRequestCount, href: substitutionsHref, label: "Sustituciones" },
      ]} />
      {view === "additional" ? <><RequestFilters defaultStatus="pending" {...filters} /><AdminRequestList filtered={filters.date !== "all" || filters.status !== "pending"} filters={filters} initialPage={page} /></> : <AdminSubstitutionNotificationList initialPage={page} />}
    </section>
  );
}
