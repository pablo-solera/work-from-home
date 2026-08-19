import type { SessionUser } from "@/lib/auth/session";
import { getAdminCalendarOverview, getAdminCalendarUsers, getAdminUserCalendar, getCoordinatorCalendarOverview, getCoordinatorCalendarUsers, getCoordinatorEmployeeCalendar, getTeamCalendarForViewer } from "./calendar-read-service";
import type { AdminCalendarDaySummary } from "./calendar-transform";
import type { CalendarCell } from "./dates";

export type DashboardCalendarScope = "admin" | "coverage" | "team";
export type DashboardCalendarPerson = { id: string; name: string; email: string };
export type DashboardCalendarOverview = {
  cells: CalendarCell[];
  daySummariesByDate: Record<string, AdminCalendarDaySummary>;
  monthName: string;
  people: DashboardCalendarPerson[];
};
export type DashboardCalendarDetail = {
  calendar: {
    cells: CalendarCell[];
    monthName: string;
    pendingDates: string[];
    selectedDates: string[];
    weeklyAllowance: number;
    weeklyCounts: Record<string, number>;
  };
  people: DashboardCalendarPerson[];
  person: DashboardCalendarPerson;
};

export async function getDashboardCalendarOverview(scope: DashboardCalendarScope, viewer: SessionUser, year: number, month: number): Promise<DashboardCalendarOverview | null> {
  if (scope === "team" && viewer.role === "employee") {
    const overview = await getTeamCalendarForViewer(viewer, year, month);
    return overview ? { ...overview, people: [] } : null;
  }

  if (scope === "team") {
    const overview = await getCoordinatorCalendarOverview(viewer.id, year, month);
    return { cells: overview.cells, daySummariesByDate: overview.daySummariesByDate, monthName: overview.monthName, people: overview.employees };
  }

  const overview = await getAdminCalendarOverview(year, month);
  return { cells: overview.cells, daySummariesByDate: overview.daySummariesByDate, monthName: overview.monthName, people: overview.users };
}

export async function getDashboardCalendarDetail(scope: DashboardCalendarScope, viewer: SessionUser, employeeId: string, year: number, month: number): Promise<DashboardCalendarDetail | null> {
  if (scope === "team") {
    const [people, detail] = await Promise.all([getCoordinatorCalendarUsers(viewer.id), getCoordinatorEmployeeCalendar(viewer.id, employeeId, year, month)]);
    return detail ? { calendar: detail, people, person: detail.employee } : null;
  }

  const [people, detail] = await Promise.all([getAdminCalendarUsers(), getAdminUserCalendar(employeeId, year, month)]);
  return detail ? { calendar: detail, people, person: detail.user } : null;
}
