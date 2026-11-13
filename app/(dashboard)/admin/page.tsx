import { CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDetailLayout, CalendarOverviewLayout } from "@/components/calendar/calendar-page-layout";
import { requireAdmin } from "@/lib/auth/guards";
import { getDashboardCalendarDetail, getDashboardCalendarOverview } from "@/lib/calendar/dashboard-calendar-service";
import { parseCalendarMonth } from "@/lib/calendar/dates";
import { getCalendarNavigation } from "@/lib/calendar/calendar-view";

type AdminPageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedUserId = params?.employeeId ?? "all";
  const overviewNavigation = getCalendarNavigation("/admin", year, month);
  const adminLinks = (
    <div className="grid gap-3 md:grid-cols-2">
      <Link className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-panel transition-colors hover:border-zinc-400" href="/calendar">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-950 group-hover:text-white"><CalendarDays className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <h2 className="font-semibold text-zinc-950">Mi calendario</h2>
          <p className="mt-0.5 text-sm text-zinc-600">Marca tus propios días de teletrabajo.</p>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-zinc-500" />
      </Link>
      <Link className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-panel transition-colors hover:border-zinc-400" href="/admin/users">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-950 group-hover:text-white"><Users className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <h2 className="font-semibold text-zinc-950">Gestión de usuarios</h2>
          <p className="mt-0.5 text-sm text-zinc-600">Administra los permisos de teletrabajo del personal.</p>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-zinc-500" />
      </Link>
    </div>
  );
  if (selectedUserId === admin.id) {
    redirect(overviewNavigation.currentMonthHref);
  }

  if (selectedUserId !== "all") {
    const userCalendar = await getDashboardCalendarDetail("admin", admin, selectedUserId, year, month);

    if (userCalendar) {
      const navigation = getCalendarNavigation("/admin", year, month, selectedUserId);
      const selectableUsers = userCalendar.people.filter((user) => user.id !== admin.id);
      return <CalendarDetailLayout basePath="/admin" calendar={userCalendar.calendar} employees={selectableUsers} enforceWeeklyAllowance={false} headerContent={adminLinks} minimumEditableDate={undefined} month={month} navigation={navigation} selectedEmployeeId={selectedUserId} spacing="8" targetUserId={userCalendar.person.id} title={`Teletrabajo de ${userCalendar.person.name}`} year={year} />;
    }
  }

  const overview = await getDashboardCalendarOverview("admin", admin, year, month);
  if (!overview) return <section aria-labelledby="admin-empty-title" className="rounded-xl border border-zinc-200 bg-white p-6"><h1 className="text-xl font-semibold text-zinc-950" id="admin-empty-title">No hay personas disponibles</h1><p className="mt-2 text-sm text-zinc-600">No se encontraron empleados para mostrar en este calendario.</p></section>;

  const selectableUsers = overview.people.filter((user) => user.id !== admin.id);

  return <CalendarOverviewLayout basePath="/admin" cells={overview.cells} daySummariesByDate={overview.daySummariesByDate} employees={selectableUsers} headerContent={adminLinks} month={month} monthName={overview.monthName} navigation={overviewNavigation} spacing="8" title="Vista global de teletrabajo" year={year} />;
}
