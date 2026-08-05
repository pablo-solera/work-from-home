import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { EditableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getCoordinatorCalendarOverview, getCoordinatorCalendarUsers, getCoordinatorEmployeeCalendar, getTeamCalendarForViewer } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getMadridTodayDateKey, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";
import { createCalendarHref } from "@/lib/calendar/links";

type TeamPageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

function teamHref(year: number, month: number, employeeId?: string) {
  return createCalendarHref("/team", { employeeId, month, year });
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const user = await requireAuthorizedUser();
  if (user.role === "admin") redirect("/admin");

  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedEmployeeId = params?.employeeId ?? "all";
  const currentMonth = getCurrentCalendarMonth();
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;

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
          currentMonthHref={createMonthHref("/team", currentMonth)}
          daySummariesByDate={overview.daySummariesByDate}
          dayDetailEndpoint="/api/calendar/team/day"
          monthName={overview.monthName}
          nextMonthHref={createMonthHref("/team", getNextMonth(year, month))}
          previousMonthHref={createMonthHref("/team", getPreviousMonth(year, month))}
          showCurrentMonthLink={showCurrentMonthLink}
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
      return (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">Mi equipo</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {employeeCalendar.employee.name}</h1>
          </div>
          <EmployeeCalendarFilter basePath="/team" employees={employees} month={month} selectedEmployeeId={selectedEmployeeId} year={year} />
          <EditableMonthCalendar
            cells={employeeCalendar.cells}
            currentMonthHref={teamHref(currentMonth.year, currentMonth.month, selectedEmployeeId)}
            month={month}
            monthName={employeeCalendar.monthName}
            nextMonthHref={teamHref(getNextMonth(year, month).year, getNextMonth(year, month).month, selectedEmployeeId)}
            previousMonthHref={teamHref(getPreviousMonth(year, month).year, getPreviousMonth(year, month).month, selectedEmployeeId)}
            selectedDates={employeeCalendar.selectedDates}
            showCurrentMonthLink={showCurrentMonthLink}
            targetUserId={employeeCalendar.employee.id}
            minimumEditableDate={employeeCalendar.employee.id === user.id ? getMadridTodayDateKey() : undefined}
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
        currentMonthHref={createMonthHref("/team", currentMonth)}
        daySummariesByDate={overview.daySummariesByDate}
        monthName={overview.monthName}
        nextMonthHref={createMonthHref("/team", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/team", getPreviousMonth(year, month))}
        showCurrentMonthLink={showCurrentMonthLink}
      />
    </section>
  );
}
