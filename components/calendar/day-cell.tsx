import { Ban, Check, Loader2, Plus } from "lucide-react";
import { formatDateKeyForDisplay, getMadridTodayDateKey, isSubstitutionLocked } from "@/lib/calendar/dates";

export type RequestMode = "chooser" | "additional" | "removal" | "substitution-source" | "substitution-target";

export function isDateLockedForMode(date: string, mode: RequestMode | null) {
  return mode !== null && mode !== "chooser" && isSubstitutionLocked(date);
}

function PendingIndicator() {
  return <span className="relative flex size-3" title="Solicitud pendiente"><span className="sr-only">Solicitud pendiente</span><span aria-hidden="true" className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" /><span aria-hidden="true" className="relative inline-flex size-3 rounded-full bg-amber-500" /></span>;
}

function DayNumber({ dayNumber, isToday }: { dayNumber: number; isToday: boolean }) {
  return <span aria-current={isToday ? "date" : undefined} className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold text-zinc-950"}>{dayNumber}</span>;
}

const CELL = "min-h-20 rounded-xl border p-1.5 sm:min-h-24 sm:p-3";
const REMOTE = "border-indigo-500 bg-indigo-50";
const FREE = "border-zinc-200 bg-white";
const TODAY_RING = "ring-2 ring-zinc-950/20";

type DayCellProps = {
  canEdit: boolean;
  date: string;
  dayNumber: number;
  holidayName: string | null;
  isHoliday: boolean;
  isToday: boolean;
  isWeekend: boolean;
  month: number;
  minimumEditableDate?: string;
  pending: boolean;
  saving?: boolean;
  requestMode: RequestMode | null;
  requestSelected: boolean;
  substitutionWeek?: { start: string; end: string };
  selected: boolean;
  weeklyAllowance?: number;
  weeklyCount?: number;
  enforceWeeklyAllowance?: boolean;
  targetUserId: string;
  year: number;
  onRequestClick: (date: string) => void;
  onToggle?: (date: string, enabled: boolean) => void;
};

export function DayCell({ canEdit, date, dayNumber, holidayName, isHoliday, isToday, isWeekend, minimumEditableDate, pending, saving = false, requestMode, requestSelected, selected, substitutionWeek, weeklyAllowance = Number.MAX_SAFE_INTEGER, weeklyCount = 0, enforceWeeklyAllowance = true, onRequestClick, onToggle }: DayCellProps) {
  if (isWeekend || isHoliday) {
    return (
      <div className={`${CELL} text-zinc-500 ${isToday ? "border-zinc-950 bg-zinc-100 ring-2 ring-zinc-950/10" : "border-zinc-200 bg-zinc-50"}`}>
        <span aria-current={isToday ? "date" : undefined} className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold"}>{dayNumber}</span>
        {isHoliday ? <span aria-hidden="true" className="mt-2 block size-2 rounded-full bg-tdia-festivo sm:hidden" /> : null}
        <p className="sr-only mt-4 text-xs sm:not-sr-only">{holidayName ?? "Fin de semana"}</p>
      </div>
    );
  }

  if (requestMode && requestMode !== "chooser") {
    const isOutsideSubstitutionWeek = requestMode === "substitution-target" && substitutionWeek && (date < substitutionWeek.start || date > substitutionWeek.end);
    const isPastDate = date < getMadridTodayDateKey();
    const isSubstitutionLockedDate = isDateLockedForMode(date, requestMode);
    const blockedReason = isSubstitutionLockedDate ? "Fuera de plazo" : isPastDate ? "Fecha pasada" : pending ? "Pendiente" : isOutsideSubstitutionWeek ? "Otra semana" : requestMode === "additional" && selected ? "Ya asignado" : (requestMode === "substitution-source" || requestMode === "removal") && !selected ? "Sin teletrabajo" : requestMode === "substitution-target" && selected ? "Ya asignado" : null;
    const canSelect = !blockedReason;
    const label = blockedReason ?? (requestSelected ? "Seleccionado" : requestMode === "additional" ? "Seleccionar" : "Elegir día");
    return (
      <button aria-label={`${formatDateKeyForDisplay(date)}, ${label}`} aria-current={isToday ? "date" : undefined} className={`${CELL} w-full cursor-pointer text-left transition-colors ${requestSelected ? "border-sky-500 bg-sky-100/70" : selected ? REMOTE : `${FREE} ${canSelect ? "hover:border-zinc-400 hover:bg-zinc-50" : ""}`} ${isToday ? TODAY_RING : ""} disabled:cursor-not-allowed disabled:opacity-60`} disabled={!canSelect} onClick={() => onRequestClick(date)} type="button">
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <span className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold text-zinc-950"}>{dayNumber}</span>
            {pending ? <PendingIndicator /> : null}
          </div>
          <span className="hidden rounded-lg border border-zinc-300 bg-white/70 px-2 py-1 text-center text-xs font-medium text-zinc-700 sm:block">{label}</span>
          {requestSelected ? <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-sky-700 text-white sm:hidden"><Check className="size-3.5" /></span> : null}
        </div>
      </button>
    );
  }

  if (!canEdit || (minimumEditableDate && date < minimumEditableDate)) {
    return (
      <div className={`${CELL} ${selected ? REMOTE : FREE} ${isToday ? TODAY_RING : ""}`}>
        <div className="flex h-full flex-col justify-between gap-2 sm:gap-4">
          <div className="flex items-start justify-between">
            <DayNumber dayNumber={dayNumber} isToday={isToday} />
            {pending ? <PendingIndicator /> : null}
          </div>
          <p className={`flex items-center gap-1.5 text-xs ${selected ? "font-medium text-indigo-900" : "text-zinc-600"}`}>
            {selected ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-indigo-600" /> : null}
            <span className="sr-only sm:not-sr-only">{selected ? "Teletrabajo" : "Sin asignar"}</span>
          </p>
        </div>
      </div>
    );
  }

  const weeklyLimitReached = enforceWeeklyAllowance && !selected && weeklyCount >= weeklyAllowance;
  const stateLabel = saving ? "Guardando…" : selected ? "Quitar" : weeklyLimitReached ? "Cupo completo" : "Marcar";
  const StateIcon = saving ? Loader2 : selected ? Check : weeklyLimitReached ? Ban : Plus;
  return (
    <form action={async () => onToggle?.(date, !selected)} className={`${CELL} ${selected ? REMOTE : FREE} ${isToday ? TODAY_RING : ""}`}>
      <div className="flex h-full flex-col justify-between gap-2 sm:gap-4">
        <div className="flex items-start justify-between">
          <DayNumber dayNumber={dayNumber} isToday={isToday} />
          {!selected ? <span className="hidden text-[11px] tabular-nums text-zinc-600 sm:inline"><span className="sr-only">Días de teletrabajo esta semana: </span>{weeklyCount}/{weeklyAllowance}</span> : null}
        </div>
        <button aria-label={`${selected ? "Quitar" : "Marcar"} teletrabajo el ${formatDateKeyForDisplay(date)}`} aria-pressed={selected} className={`inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8 sm:px-2 ${selected ? "border-indigo-400 bg-white text-indigo-900 hover:bg-indigo-100" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"}`} disabled={saving || weeklyLimitReached} title={weeklyLimitReached ? "Cupo semanal completo" : undefined} type="submit">
          <StateIcon aria-hidden="true" className={`size-4 sm:size-3.5 ${saving ? "animate-spin" : ""}`} />
          <span className="sr-only sm:not-sr-only">{stateLabel}</span>
        </button>
      </div>
    </form>
  );
}
