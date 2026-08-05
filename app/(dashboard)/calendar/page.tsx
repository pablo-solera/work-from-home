import { EditableMonthCalendar, RequestableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import { PageHeader } from "@/components/common/page-header";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getMinimumEditableDate, getUserCalendar } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";

type CalendarPageProps = {
  searchParams?: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireAuthorizedUser();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const currentMonth = getCurrentCalendarMonth();
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;

  const calendar = await getUserCalendar(user.id, year, month);
  const CalendarComponent = user.role === "employee" || user.role === "coordinator" ? RequestableMonthCalendar : EditableMonthCalendar;

  return (
    <section className="space-y-6">
      <PageHeader><PageHeader.Eyebrow>Mi calendario</PageHeader.Eyebrow><PageHeader.Title>Días de teletrabajo</PageHeader.Title></PageHeader>
        <CalendarComponent
        cells={calendar.cells}
        currentMonthHref={createMonthHref("/calendar", currentMonth)}
        month={month}
        monthName={calendar.monthName}
        nextMonthHref={createMonthHref("/calendar", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/calendar", getPreviousMonth(year, month))}
          selectedDates={calendar.selectedDates}
          pendingDates={calendar.pendingDates}
        showCurrentMonthLink={showCurrentMonthLink}
        targetUserId={user.id}
        minimumEditableDate={getMinimumEditableDate(user.role)}
        year={year}
      />
    </section>
  );
}
