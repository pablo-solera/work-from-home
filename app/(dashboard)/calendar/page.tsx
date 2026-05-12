import { MonthCalendar } from "@/components/calendar/month-calendar";
import { requireUser } from "@/lib/auth/guards";
import { getUserCalendar } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";

type CalendarPageProps = {
  searchParams?: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const currentMonth = getCurrentCalendarMonth();
  const calendar = await getUserCalendar(user.id, year, month);
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Mi calendario</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Días de teletrabajo</h1>
      </div>
      <MonthCalendar
        cells={calendar.cells}
        currentMonthHref={createMonthHref("/calendar", currentMonth)}
        month={month}
        monthName={calendar.monthName}
        nextMonthHref={createMonthHref("/calendar", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/calendar", getPreviousMonth(year, month))}
        selectedDates={calendar.selectedDates}
        showCurrentMonthLink={showCurrentMonthLink}
        year={year}
      />
    </section>
  );
}
