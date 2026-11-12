import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import type { AdminCalendarDay } from "./admin-calendar";

type AdminDayCellProps = {
  day: AdminCalendarDay;
  onPrefetch?: (day: AdminCalendarDay) => void;
  onSelect: (day: AdminCalendarDay) => void;
};

export function canOpenDayDetails(day: AdminCalendarDay) {
  return !(day.isOutOfRange ?? false) && (day.remoteCount > 0 || day.absenceCount > 0 || day.officeCount > 0);
}

function Stat({ count, dot, label, tone }: { count: number; dot: string; label: string; tone: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span className="tabular-nums">{count}</span>
      <span className="hidden truncate sm:inline">{label}</span>
    </p>
  );
}

export function AdminDayCell({ day, onPrefetch, onSelect }: AdminDayCellProps) {
  const isOutOfRange = day.isOutOfRange ?? false;
  const canOpenDetails = canOpenDayDetails(day);
  const isDisabledDay = day.isWeekend || day.isHoliday;

  return (
    <button
      className={`min-h-20 rounded-xl border p-1.5 text-left transition-colors sm:min-h-32 sm:p-3 ${isDisabledDay ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-white"} ${canOpenDetails ? "cursor-pointer hover:border-zinc-400 hover:bg-zinc-50" : "cursor-default"} ${day.isToday ? "ring-2 ring-zinc-950/20" : ""}`}
      aria-current={day.isToday ? "date" : undefined}
      aria-label={`${formatDateKeyForDisplay(day.date)}${canOpenDetails ? ", abrir detalle" : ""}`}
      aria-haspopup={canOpenDetails ? "dialog" : undefined}
      disabled={!canOpenDetails}
      onClick={() => onSelect(day)}
      onFocus={() => onPrefetch?.(day)}
      onPointerEnter={() => onPrefetch?.(day)}
      type="button"
    >
      <div className="flex h-full flex-col justify-between gap-2 sm:gap-4">
        <p className={day.isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : isDisabledDay ? "font-semibold text-zinc-500" : "font-semibold text-zinc-950"}>{day.dayNumber}</p>

        <div className="space-y-1">
          {day.officeCount > 0 ? <Stat count={day.officeCount} dot="bg-zinc-500" label="en oficina" tone="text-zinc-700" /> : null}
          {day.remoteCount > 0 ? (
            <Stat count={day.remoteCount} dot="bg-indigo-600" label="en teletrabajo" tone="text-indigo-800" />
          ) : isDisabledDay && !isOutOfRange ? (
            <p className="hidden truncate text-xs text-zinc-500 sm:block">{day.holidayName ?? "Fin de semana"}</p>
          ) : null}
          {day.absenceCount > 0 ? <Stat count={day.absenceCount} dot="bg-tdia-ausencias" label={day.absenceCount === 1 ? "ausencia" : "ausencias"} tone="text-zinc-700" /> : null}
        </div>
      </div>
    </button>
  );
}
