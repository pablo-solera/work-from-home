import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import type { AdminCalendarDay } from "./admin-calendar";

type AdminDayCellProps = {
  day: AdminCalendarDay;
  onSelect: (day: AdminCalendarDay) => void;
};

export function AdminDayCell({ day, onSelect }: AdminDayCellProps) {
  const total = day.remoteCount;
  const officeCount = day.officeCount;
  const absencesCount = day.absenceCount;
  const canOpenDetails = total > 0 || absencesCount > 0 || officeCount > 0;
  const isDisabledDay = day.isWeekend || day.isHoliday;

  return (
    <button
      className={`min-h-32 rounded-xl border p-3 text-left transition ${isDisabledDay ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-white hover:border-zinc-400"
        } ${day.isToday ? "ring-2 ring-zinc-950/20" : ""} ${canOpenDetails ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" : "cursor-default"}`}
      aria-label={`${formatDateKeyForDisplay(day.date)}${canOpenDetails ? ", abrir detalle" : ""}`}
      aria-haspopup={canOpenDetails ? "dialog" : undefined}
      disabled={!canOpenDetails}
      onClick={() => onSelect(day)}
      type="button"
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className={day.isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : isDisabledDay ? "font-semibold text-zinc-400" : "font-semibold text-zinc-950"}>{day.dayNumber}</p>
        </div>

        <div className="space-y-1">
          {officeCount > 0 ? (
            <p className="text-xs font-medium text-emerald-600">
              {officeCount} en oficina
            </p>
          ) : null}
          {total > 0 ? (
            <p className="text-xs font-medium text-zinc-700">
              {total} en teletrabajo
            </p>
          ) : isDisabledDay ? (
            <p className="text-xs text-zinc-400">{day.holidayName ?? "Fin de semana"}</p>
          ) : null}
          {absencesCount > 0 ? (
            <p className="text-xs font-medium text-amber-600">
              {absencesCount} {absencesCount === 1 ? "ausencia" : "ausencias"}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
