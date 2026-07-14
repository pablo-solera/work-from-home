import { GeneratedAvatar } from "@/components/common/generated-avatar";
import type { AdminCalendarDay } from "./admin-calendar";

type AdminDayCellProps = {
  day: AdminCalendarDay;
  onSelect: (day: AdminCalendarDay) => void;
};

const VISIBLE_AVATARS = 3;

export function AdminDayCell({ day, onSelect }: AdminDayCellProps) {
  const teletrabajo = day.sections.teletrabajo;
  const total = teletrabajo.length;
  const visibleEntries = teletrabajo.slice(0, VISIBLE_AVATARS);
  const hiddenCount = Math.max(total - VISIBLE_AVATARS, 0);
  const officeCount = day.sections.enOficina.length;
  const absencesCount =
    day.sections.vacaciones.length +
    day.sections.ausencias.length +
    day.sections.bajas.length +
    day.sections.viajes.length +
    day.sections.permisos.length +
    day.sections.excedencia.length +
    day.sections.mudanza.length;
  const canOpenDetails = total > 0 || absencesCount > 0 || officeCount > 0;
  const isDisabledDay = day.isWeekend || day.isHoliday;

  return (
    <button
      className={`min-h-32 rounded-xl border p-3 text-left transition ${isDisabledDay ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-white hover:border-zinc-400"
        } ${day.isToday ? "ring-2 ring-zinc-950/20" : ""} ${canOpenDetails ? "cursor-pointer" : "cursor-default"}`}
      disabled={!canOpenDetails}
      onClick={() => onSelect(day)}
      type="button"
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className={day.isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : isDisabledDay ? "font-semibold text-zinc-400" : "font-semibold text-zinc-950"}>{day.dayNumber}</p>
          {total > 0 ? (
            <div className="mt-4 flex -space-x-2">
              {visibleEntries.map((entry, index) => (
                <GeneratedAvatar className="size-8 border-2 border-white text-xs" key={entry.userId ?? `${entry.userName}-${index}`} name={entry.userName} />
              ))}
              {hiddenCount > 0 ? (
                <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-xs font-semibold text-zinc-700">
                  +{hiddenCount}
                </div>
              ) : null}
            </div>
          ) : null}
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
          ) : (
            <p className="text-xs text-zinc-500">Sin personas</p>
          )}
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
