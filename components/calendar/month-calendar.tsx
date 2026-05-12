import Link from "next/link";
import type { CalendarCell } from "@/lib/calendar/dates";
import { DayCell } from "./day-cell";

type MonthCalendarProps = {
  cells: CalendarCell[];
  monthName: string;
  selectedDates: string[];
  previousMonthHref: string;
  currentMonthHref: string;
  nextMonthHref: string;
  showCurrentMonthLink: boolean;
  year: number;
  month: number;
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthCalendar({
  cells,
  monthName,
  selectedDates,
  previousMonthHref,
  currentMonthHref,
  nextMonthHref,
  showCurrentMonthLink,
  year,
  month,
}: MonthCalendarProps) {
  const selected = new Set(selectedDates);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <h2 className="text-xl font-semibold capitalize text-zinc-950">{monthName}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link className="rounded-lg border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100" href={previousMonthHref}>
            Mes anterior
          </Link>
          {showCurrentMonthLink ? (
            <Link className="rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800" href={currentMonthHref}>
              Mes actual
            </Link>
          ) : null}
          <Link className="rounded-lg border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100" href={nextMonthHref}>
            Mes siguiente
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((weekDay) => (
          <div key={weekDay} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {weekDay}
          </div>
        ))}
        {cells.map((cell, index) =>
          cell ? (
            <DayCell
              key={cell.date}
              date={cell.date}
              dayNumber={cell.dayNumber}
              holidayName={cell.holidayName}
              isHoliday={cell.isHoliday}
              isToday={cell.isToday}
              isWeekend={cell.isWeekend}
              month={month}
              selected={selected.has(cell.date)}
              year={year}
            />
          ) : (
            <div key={`empty-${index}`} className="min-h-24 rounded-xl border border-transparent" />
          )
        )}
      </div>
    </div>
  );
}
