import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import type { CalendarCell } from "@/lib/calendar/dates";
import { DayCell } from "./day-cell";
import { ReplicateControls } from "./replicate-controls";

type MonthCalendarProps = {
  canEdit: boolean;
  cells: CalendarCell[];
  monthName: string;
  selectedDates: string[];
  previousMonthHref: string;
  currentMonthHref: string;
  nextMonthHref: string;
  showCurrentMonthLink: boolean;
  targetUserId: string;
  year: number;
  month: number;
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthCalendar({
  canEdit,
  cells,
  monthName,
  selectedDates,
  previousMonthHref,
  currentMonthHref,
  nextMonthHref,
  showCurrentMonthLink,
  targetUserId,
  year,
  month,
}: MonthCalendarProps) {
  const selected = new Set(selectedDates);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold capitalize text-zinc-950">{monthName}</h2>
          <div className="inline-flex items-center gap-2">
            <Link aria-label="Mes anterior" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100" href={previousMonthHref}>
              <ChevronLeftIcon className="size-5" />
            </Link>
            {showCurrentMonthLink ? (
              <Link className="cursor-pointer rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800" href={currentMonthHref}>
                Mes actual
              </Link>
            ) : (
              <span aria-disabled="true" className="cursor-not-allowed rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white opacity-50">
                Mes actual
              </span>
            )}
            <Link aria-label="Mes siguiente" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100" href={nextMonthHref}>
              <ChevronRightIcon className="size-5" />
            </Link>
          </div>
        </div>
        {canEdit ? <ReplicateControls month={month} selectedCount={selectedDates.length} targetUserId={targetUserId} year={year} /> : null}
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
              canEdit={canEdit}
              date={cell.date}
              dayNumber={cell.dayNumber}
              holidayName={cell.holidayName}
              isHoliday={cell.isHoliday}
              isToday={cell.isToday}
              isWeekend={cell.isWeekend}
              month={month}
              selected={selected.has(cell.date)}
              targetUserId={targetUserId}
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
