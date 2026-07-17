import { EditableMonthCalendar, RequestableMonthCalendar } from "@/components/calendar/month-calendar-variants";
import { PageHeader } from "@/components/common/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getUserCalendar } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getMadridTodayDateKey, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";

type CalendarPageProps = {
  searchParams?: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const currentMonth = getCurrentCalendarMonth();
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;

  const calendar = await getUserCalendar(user.id, year, month);
  const CalendarComponent = user.role === "employee" ? RequestableMonthCalendar : EditableMonthCalendar;

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
        minimumEditableDate={user.role === "coordinator" ? getMadridTodayDateKey() : undefined}
        year={year}
      />
    </section>
  );
}
