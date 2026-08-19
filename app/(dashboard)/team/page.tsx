import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { EditableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getCoordinatorCalendarOverview, getCoordinatorCalendarUsers, getCoordinatorEmployeeCalendar, getMinimumEditableDate, getTeamCalendarForViewer } from "@/lib/calendar/calendar-service";
import { parseCalendarMonth } from "@/lib/calendar/dates";
import { getCalendarNavigation } from "@/lib/calendar/calendar-view";

type TeamPageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const user = await requireAuthorizedUser();
  if (user.role === "admin") redirect("/admin");

  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedEmployeeId = params?.employeeId ?? "all";
  const overviewNavigation = getCalendarNavigation("/team", year, month);

  if (user.role === "employee") {
    const overview = await getTeamCalendarForViewer(user, year, month);

    if (!overview) {
      redirect("/calendar");
    }
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Mi equipo</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo del equipo</h1>
        </div>
        <AdminCalendar
          cells={overview.cells}
           currentMonthHref={overviewNavigation.currentMonthHref}
          daySummariesByDate={overview.daySummariesByDate}
          dayDetailEndpoint="/api/calendar/team/day"
          monthName={overview.monthName}
            nextMonthHref={overviewNavigation.nextMonthHref}
            previousMonthHref={overviewNavigation.previousMonthHref}
            showCurrentMonthLink={overviewNavigation.showCurrentMonthLink}
        />
      </section>
    );
  }

  if (selectedEmployeeId !== "all") {
    const [employees, employeeCalendar] = await Promise.all([
      getCoordinatorCalendarUsers(user.id),
      getCoordinatorEmployeeCalendar(user.id, selectedEmployeeId, year, month),
    ]);

    if (employeeCalendar) {
      const navigation = getCalendarNavigation("/team", year, month, selectedEmployeeId);
      return (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">Mi equipo</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {employeeCalendar.employee.name}</h1>
          </div>
          <EmployeeCalendarFilter basePath="/team" employees={employees} month={month} selectedEmployeeId={selectedEmployeeId} year={year} />
          <EditableMonthCalendar
            cells={employeeCalendar.cells}
            currentMonthHref={overviewNavigation.currentMonthHref}
            month={month}
            monthName={employeeCalendar.monthName}
            nextMonthHref={navigation.nextMonthHref}
            previousMonthHref={navigation.previousMonthHref}
            selectedDates={employeeCalendar.selectedDates}
            weeklyAllowance={employeeCalendar.weeklyAllowance}
            weeklyCounts={employeeCalendar.weeklyCounts}
            showCurrentMonthLink={navigation.showCurrentMonthLink}
            targetUserId={employeeCalendar.employee.id}
            enforceWeeklyAllowance={true}
            minimumEditableDate={getMinimumEditableDate(user.role)}
            year={year}
          />
        </section>
      );
    }
  }

  const overview = await getCoordinatorCalendarOverview(user.id, year, month);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Mi equipo</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo del equipo</h1>
      </div>
      <EmployeeCalendarFilter basePath="/team" employees={overview.employees} month={month} selectedEmployeeId="all" year={year} />
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
