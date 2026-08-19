import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDetailLayout, CalendarOverviewLayout } from "@/components/calendar/calendar-page-layout";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminCalendarOverview, getAdminCalendarUsers, getAdminUserCalendar } from "@/lib/calendar/calendar-service";
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
    <div className="grid gap-4 md:grid-cols-2">
      <Link className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-400" href="/calendar">
        <h2 className="font-semibold text-zinc-950">Mi calendario</h2>
        <p className="mt-2 text-sm text-zinc-600">Marca tus propios días de teletrabajo.</p>
      </Link>
      <Link className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-400" href="/admin/users">
        <h2 className="font-semibold text-zinc-950">Gestión de usuarios</h2>
        <p className="mt-2 text-sm text-zinc-600">Crea usuarios de forma masiva pegando correos.</p>
      </Link>
    </div>
  );
  if (selectedUserId === admin.id) {
    redirect(overviewNavigation.currentMonthHref);
  }

  if (selectedUserId !== "all") {
    const [users, userCalendar] = await Promise.all([
      getAdminCalendarUsers(),
      getAdminUserCalendar(selectedUserId, year, month),
    ]);

    if (userCalendar) {
      const navigation = getCalendarNavigation("/admin", year, month, selectedUserId);
      const selectableUsers = users.filter((user) => user.id !== admin.id);
      return <CalendarDetailLayout basePath="/admin" calendar={userCalendar} employees={selectableUsers} enforceWeeklyAllowance={false} eyebrow="Dashboard admin" headerContent={adminLinks} minimumEditableDate={undefined} month={month} navigation={navigation} selectedEmployeeId={selectedUserId} spacing="8" targetUserId={userCalendar.user.id} title={`Teletrabajo de ${userCalendar.user.name}`} year={year} />;
    }
  }

  const overview = await getAdminCalendarOverview(year, month);

  const selectableUsers = overview.users.filter((user) => user.id !== admin.id);

  return <CalendarOverviewLayout basePath="/admin" cells={overview.cells} daySummariesByDate={overview.daySummariesByDate} employees={selectableUsers} eyebrow="Dashboard admin" headerContent={adminLinks} month={month} monthName={overview.monthName} navigation={overviewNavigation} spacing="8" title="Vista global de teletrabajo" year={year} />;
}
