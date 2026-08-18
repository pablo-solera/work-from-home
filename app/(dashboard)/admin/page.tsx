import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { EditableMonthCalendar } from "@/components/calendar/month-calendar-variants";
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
      return (
        <section className="space-y-8">
          <div>
            <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {userCalendar.user.name}</h1>
          </div>
          {adminLinks}
          <EmployeeCalendarFilter
            allLabel="Todos"
            basePath="/admin"
            employees={selectableUsers}
            label="Usuario"
            month={month}
            selectedEmployeeId={selectedUserId}
            year={year}
          />
          <EditableMonthCalendar
            cells={userCalendar.cells}
            currentMonthHref={navigation.currentMonthHref}
            month={month}
            monthName={userCalendar.monthName}
            nextMonthHref={navigation.nextMonthHref}
            previousMonthHref={navigation.previousMonthHref}
             selectedDates={userCalendar.selectedDates}
             weeklyAllowance={userCalendar.weeklyAllowance}
             weeklyCounts={userCalendar.weeklyCounts}
             enforceWeeklyAllowance={false}
            showCurrentMonthLink={navigation.showCurrentMonthLink}
            targetUserId={userCalendar.user.id}
            year={year}
          />
        </section>
      );
    }
  }

  const overview = await getAdminCalendarOverview(year, month);

  const selectableUsers = overview.users.filter((user) => user.id !== admin.id);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Vista global de teletrabajo</h1>
      </div>
      {adminLinks}
      <EmployeeCalendarFilter
        allLabel="Todos"
        basePath="/admin"
         employees={selectableUsers}
        label="Usuario"
        month={month}
        selectedEmployeeId="all"
        year={year}
      />
      <AdminCalendar
        cells={overview.cells}
         currentMonthHref={overviewNavigation.currentMonthHref}
        daySummariesByDate={overview.daySummariesByDate}
        monthName={overview.monthName}
         nextMonthHref={overviewNavigation.nextMonthHref}
         previousMonthHref={overviewNavigation.previousMonthHref}
         showCurrentMonthLink={overviewNavigation.showCurrentMonthLink}
      />
    </section>
  );
}
