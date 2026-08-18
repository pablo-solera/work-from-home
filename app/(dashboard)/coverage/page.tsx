import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { EditableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getAdminCalendarOverview, getAdminCalendarUsers, getAdminUserCalendar, getMinimumEditableDate } from "@/lib/calendar/calendar-service";
import { parseCalendarMonth } from "@/lib/calendar/dates";
import { getCalendarNavigation } from "@/lib/calendar/calendar-view";
import { getUserById } from "@/lib/users/user-service";

type CoveragePageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

export default async function CoveragePage({ searchParams }: CoveragePageProps) {
  const user = await requireAuthorizedUser();
  const dbUser = await getUserById(user.id);

  if (user.role !== "admin" && !dbUser?.canEditAllWfh) {
    redirect("/calendar");
  }

  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedUserId = params?.employeeId ?? "all";
  const overviewNavigation = getCalendarNavigation("/coverage", year, month);
  if (selectedUserId !== "all") {
    const [selectableUsers, userCalendar] = await Promise.all([
      getAdminCalendarUsers(),
      getAdminUserCalendar(selectedUserId, year, month),
    ]);

    if (userCalendar) {
      const navigation = getCalendarNavigation("/coverage", year, month, selectedUserId);
      return (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">Cobertura</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {userCalendar.user.name}</h1>
          </div>
          <EmployeeCalendarFilter
            allLabel="Todos"
            basePath="/coverage"
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
            minimumEditableDate={getMinimumEditableDate(user.role)}
            year={year}
          />
        </section>
      );
    }
  }

  const overview = await getAdminCalendarOverview(year, month);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Cobertura</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Vista global de teletrabajo</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">Edita días de teletrabajo en situaciones de cobertura, sin acceder a la gestión de usuarios.</p>
      </div>
      <EmployeeCalendarFilter allLabel="Todos" basePath="/coverage" employees={overview.users} label="Usuario" month={month} selectedEmployeeId="all" year={year} />
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
