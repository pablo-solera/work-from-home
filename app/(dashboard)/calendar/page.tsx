import { EditableMonthCalendar, RequestableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import { PageHeader } from "@/components/common/page-header";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getMinimumEditableDate, getUserCalendar } from "@/lib/calendar/calendar-service";
import { getCalendarNavigation } from "@/lib/calendar/calendar-view";
import { parseCalendarMonth } from "@/lib/calendar/dates";

type CalendarPageProps = {
  searchParams?: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireAuthorizedUser();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const navigation = getCalendarNavigation("/calendar", year, month);

  const calendar = await getUserCalendar(user.id, year, month);
  const CalendarComponent = user.role === "employee" || user.role === "coordinator" ? RequestableMonthCalendar : EditableMonthCalendar;

  return (
    <section className="space-y-6">
      <PageHeader><PageHeader.Eyebrow>Mi calendario</PageHeader.Eyebrow><PageHeader.Title>Días de teletrabajo</PageHeader.Title></PageHeader>
        <CalendarComponent
        cells={calendar.cells}
        currentMonthHref={navigation.currentMonthHref}
        month={month}
        monthName={calendar.monthName}
        nextMonthHref={navigation.nextMonthHref}
        previousMonthHref={navigation.previousMonthHref}
          selectedDates={calendar.selectedDates}
          weeklyAllowance={calendar.weeklyAllowance}
          weeklyCounts={calendar.weeklyCounts}
          pendingDates={calendar.pendingDates}
        showCurrentMonthLink={navigation.showCurrentMonthLink}
        targetUserId={user.id}
        minimumEditableDate={getMinimumEditableDate(user.role)}
        year={year}
      />
    </section>
  );
}
