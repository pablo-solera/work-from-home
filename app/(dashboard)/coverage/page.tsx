import { redirect } from "next/navigation";
import { CalendarDetailLayout, CalendarOverviewLayout } from "@/components/calendar/calendar-page-layout";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getMinimumEditableDate } from "@/lib/calendar/calendar-service";
import { getDashboardCalendarDetail, getDashboardCalendarOverview } from "@/lib/calendar/dashboard-calendar-service";
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
    const userCalendar = await getDashboardCalendarDetail("coverage", user, selectedUserId, year, month);

    if (userCalendar) {
      const navigation = getCalendarNavigation("/coverage", year, month, selectedUserId);
      return <CalendarDetailLayout basePath="/coverage" calendar={userCalendar.calendar} employees={userCalendar.people} enforceWeeklyAllowance={false} eyebrow="Cobertura" minimumEditableDate={getMinimumEditableDate(user.role)} month={month} navigation={navigation} selectedEmployeeId={selectedUserId} targetUserId={userCalendar.person.id} title={`Teletrabajo de ${userCalendar.person.name}`} year={year} />;
    }
  }

  const overview = await getDashboardCalendarOverview("coverage", user, year, month);
  if (!overview) return null;

  return <CalendarOverviewLayout basePath="/coverage" cells={overview.cells} daySummariesByDate={overview.daySummariesByDate} description="Edita días de teletrabajo en situaciones de cobertura, sin acceder a la gestión de usuarios." employees={overview.people} eyebrow="Cobertura" month={month} monthName={overview.monthName} navigation={overviewNavigation} title="Vista global de teletrabajo" year={year} />;
}
