import { redirect } from "next/navigation";
import { CalendarDetailLayout, CalendarOverviewLayout } from "@/components/calendar/calendar-page-layout";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getMinimumEditableDate } from "@/lib/calendar/calendar-service";
import { getDashboardCalendarDetail, getDashboardCalendarOverview } from "@/lib/calendar/dashboard-calendar-service";
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
    const overview = await getDashboardCalendarOverview("team", user, year, month);

    if (!overview) {
      redirect("/calendar");
    }
    return <CalendarOverviewLayout basePath="/team" cells={overview.cells} dayDetailEndpoint="/api/calendar/team/day" daySummariesByDate={overview.daySummariesByDate} employees={[]} month={month} monthName={overview.monthName} navigation={overviewNavigation} showFilter={false} title="Teletrabajo del equipo" year={year} />;
  }

  if (selectedEmployeeId !== "all") {
    const employeeCalendar = await getDashboardCalendarDetail("team", user, selectedEmployeeId, year, month);

    if (employeeCalendar) {
      const navigation = getCalendarNavigation("/team", year, month, selectedEmployeeId);
      return <CalendarDetailLayout basePath="/team" calendar={employeeCalendar.calendar} employees={employeeCalendar.people} enforceWeeklyAllowance={true} filterLabel="Empleado" minimumEditableDate={getMinimumEditableDate(user.role)} month={month} navigation={navigation} selectedEmployeeId={selectedEmployeeId} targetUserId={employeeCalendar.person.id} title={`Teletrabajo de ${employeeCalendar.person.name}`} year={year} />;
    }
  }

  const overview = await getDashboardCalendarOverview("team", user, year, month);
  if (!overview) return <section aria-labelledby="team-empty-title" className="rounded-xl border border-zinc-200 bg-white p-6"><h1 className="text-xl font-semibold text-zinc-950" id="team-empty-title">No hay personas disponibles</h1><p className="mt-2 text-sm text-zinc-600">No se encontraron integrantes para mostrar en este calendario.</p></section>;

  return <CalendarOverviewLayout basePath="/team" cells={overview.cells} daySummariesByDate={overview.daySummariesByDate} employees={overview.people} filterLabel="Empleado" month={month} monthName={overview.monthName} navigation={overviewNavigation} title="Teletrabajo del equipo" year={year} />;
}
