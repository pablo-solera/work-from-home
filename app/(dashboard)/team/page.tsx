import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { requireUser } from "@/lib/auth/guards";
import { getCoordinatorCalendarOverview, getCoordinatorEmployeeCalendar } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";

type TeamPageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

function teamHref(year: number, month: number, employeeId?: string) {
  const employeeParam = employeeId && employeeId !== "all" ? `&employeeId=${employeeId}` : "";

  return `/team?year=${year}&month=${month}${employeeParam}`;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const user = await requireUser();

  if (user.role !== "coordinator") {
    redirect("/calendar");
  }

  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedEmployeeId = params?.employeeId ?? "all";
  const currentMonth = getCurrentCalendarMonth();
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;
  const overview = await getCoordinatorCalendarOverview(user.id, year, month, selectedEmployeeId === "all" ? undefined : selectedEmployeeId);

  if (selectedEmployeeId !== "all") {
    const employeeCalendar = await getCoordinatorEmployeeCalendar(user.id, selectedEmployeeId, year, month);

    if (employeeCalendar) {
      return (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">Mi equipo</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {employeeCalendar.employee.name}</h1>
          </div>
          <EmployeeCalendarFilter basePath="/team" employees={overview.employees} month={month} selectedEmployeeId={selectedEmployeeId} year={year} />
          <MonthCalendar
            canEdit
            cells={employeeCalendar.cells}
            currentMonthHref={teamHref(currentMonth.year, currentMonth.month, selectedEmployeeId)}
            month={month}
            monthName={employeeCalendar.monthName}
            nextMonthHref={teamHref(getNextMonth(year, month).year, getNextMonth(year, month).month, selectedEmployeeId)}
            previousMonthHref={teamHref(getPreviousMonth(year, month).year, getPreviousMonth(year, month).month, selectedEmployeeId)}
            selectedDates={employeeCalendar.selectedDates}
            showCurrentMonthLink={showCurrentMonthLink}
            targetUserId={employeeCalendar.employee.id}
            year={year}
          />
        </section>
      );
    }
  }

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
        entriesByDate={overview.entriesByDate}
        monthName={overview.monthName}
        nextMonthHref={createMonthHref("/team", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/team", getPreviousMonth(year, month))}
        showCurrentMonthLink={showCurrentMonthLink}
      />
    </section>
  );
}
