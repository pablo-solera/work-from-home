import { AdminCalendar } from "@/components/admin/admin-calendar";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { EditableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import type { AdminCalendarDaySummary } from "@/lib/calendar/calendar-service";
import type { CalendarCell } from "@/lib/calendar/dates";

type CalendarNavigation = {
  currentMonthHref: string;
  nextMonthHref: string;
  previousMonthHref: string;
  showCurrentMonthLink: boolean;
};

type PersonOption = { id: string; name: string; email: string };

type PageFrameProps = {
  children: React.ReactNode;
  description?: string;
  headerContent?: React.ReactNode;
  spacing?: "6" | "8";
  title: string;
};

function PageFrame({ children, description, headerContent, spacing = "6", title }: PageFrameProps) {
  return (
    <section className={spacing === "8" ? "space-y-8" : "space-y-6"}>
      <PageHeader>
        <PageHeader.Title>{title}</PageHeader.Title>
        {description ? <PageHeader.Description>{description}</PageHeader.Description> : null}
      </PageHeader>
      {headerContent}
      {children}
    </section>
  );
}

export function CalendarOverviewLayout({ basePath, cells, dayDetailEndpoint, daySummariesByDate, description, employees, filterLabel, headerContent, month, monthName, navigation, selectedEmployeeId = "all", showFilter, spacing, title, year }: {
  basePath: string;
  cells: CalendarCell[];
  dayDetailEndpoint?: string;
  daySummariesByDate: Record<string, AdminCalendarDaySummary>;
  description?: string;
  employees: PersonOption[];
  filterLabel?: string;
  headerContent?: React.ReactNode;
  monthName: string;
  month: number;
  navigation: CalendarNavigation;
  selectedEmployeeId?: string;
  showFilter?: boolean;
  spacing?: "6" | "8";
  title: string;
  year: number;
}) {
  return (
    <PageFrame description={description} headerContent={headerContent} spacing={spacing} title={title}>
      {showFilter !== false ? <EmployeeCalendarFilter allLabel="Todos" basePath={basePath} employees={employees} label={filterLabel ?? "Usuario"} month={month} selectedEmployeeId={selectedEmployeeId} year={year} /> : null}
      <AdminCalendar cells={cells} currentMonthHref={navigation.currentMonthHref} dayDetailEndpoint={dayDetailEndpoint} daySummariesByDate={daySummariesByDate} monthName={monthName} nextMonthHref={navigation.nextMonthHref} previousMonthHref={navigation.previousMonthHref} showCurrentMonthLink={navigation.showCurrentMonthLink} />
    </PageFrame>
  );
}

type EditableCalendarData = {
  cells: CalendarCell[];
  monthName: string;
  pendingDates: string[];
  selectedDates: string[];
  weeklyAllowance: number;
  weeklyCounts: Record<string, number>;
};

export function CalendarDetailLayout({ basePath, calendar, employees, enforceWeeklyAllowance, filterLabel, headerContent, minimumEditableDate, month, navigation, selectedEmployeeId, spacing, targetUserId, title, year }: {
  basePath: string;
  calendar: EditableCalendarData;
  employees: PersonOption[];
  enforceWeeklyAllowance: boolean;
  filterLabel?: string;
  headerContent?: React.ReactNode;
  minimumEditableDate?: string;
  month: number;
  navigation: CalendarNavigation;
  selectedEmployeeId: string;
  spacing?: "6" | "8";
  targetUserId: string;
  title: string;
  year: number;
}) {
  return (
    <PageFrame headerContent={headerContent} spacing={spacing} title={title}>
      <EmployeeCalendarFilter allLabel="Todos" basePath={basePath} employees={employees} label={filterLabel ?? "Usuario"} month={month} selectedEmployeeId={selectedEmployeeId} year={year} />
      <EditableMonthCalendar cells={calendar.cells} currentMonthHref={navigation.currentMonthHref} month={month} monthName={calendar.monthName} nextMonthHref={navigation.nextMonthHref} previousMonthHref={navigation.previousMonthHref} pendingDates={calendar.pendingDates} selectedDates={calendar.selectedDates} weeklyAllowance={calendar.weeklyAllowance} weeklyCounts={calendar.weeklyCounts} enforceWeeklyAllowance={enforceWeeklyAllowance} showCurrentMonthLink={navigation.showCurrentMonthLink} targetUserId={targetUserId} minimumEditableDate={minimumEditableDate} year={year} />
    </PageFrame>
  );
}
