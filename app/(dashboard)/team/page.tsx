import { redirect } from "next/navigation";
import { CalendarDetailLayout, CalendarOverviewLayout } from "@/components/calendar/calendar-page-layout";
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
    return <CalendarOverviewLayout basePath="/team" cells={overview.cells} dayDetailEndpoint="/api/calendar/team/day" daySummariesByDate={overview.daySummariesByDate} employees={[]} eyebrow="Mi equipo" month={month} monthName={overview.monthName} navigation={overviewNavigation} showFilter={false} title="Teletrabajo del equipo" year={year} />;
  }

  if (selectedEmployeeId !== "all") {
    const [employees, employeeCalendar] = await Promise.all([
      getCoordinatorCalendarUsers(user.id),
      getCoordinatorEmployeeCalendar(user.id, selectedEmployeeId, year, month),
    ]);

    if (employeeCalendar) {
      const navigation = getCalendarNavigation("/team", year, month, selectedEmployeeId);
      return <CalendarDetailLayout basePath="/team" calendar={employeeCalendar} employees={employees} enforceWeeklyAllowance={true} eyebrow="Mi equipo" filterLabel="Empleado" minimumEditableDate={getMinimumEditableDate(user.role)} month={month} navigation={navigation} selectedEmployeeId={selectedEmployeeId} targetUserId={employeeCalendar.employee.id} title={`Teletrabajo de ${employeeCalendar.employee.name}`} year={year} />;
    }
  }

  const overview = await getCoordinatorCalendarOverview(user.id, year, month);

  return <CalendarOverviewLayout basePath="/team" cells={overview.cells} daySummariesByDate={overview.daySummariesByDate} employees={overview.employees} eyebrow="Mi equipo" filterLabel="Empleado" month={month} monthName={overview.monthName} navigation={overviewNavigation} title="Teletrabajo del equipo" year={year} />;
}
