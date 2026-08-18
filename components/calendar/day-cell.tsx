import { formatDateKeyForDisplay, getMadridTodayDateKey, isSubstitutionLocked } from "@/lib/calendar/dates";

export type RequestMode = "chooser" | "additional" | "removal" | "substitution-source" | "substitution-target";

export function isDateLockedForMode(date: string, mode: RequestMode | null) {
  return mode !== null && mode !== "chooser" && isSubstitutionLocked(date);
}

function PendingIndicator() {
  return <span aria-label="Solicitud pendiente" className="relative flex size-3" title="Solicitud pendiente"><span aria-hidden="true" className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" /><span aria-hidden="true" className="relative inline-flex size-3 rounded-full bg-amber-500" /></span>;
}

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
    return <div className={`min-h-24 rounded-xl border p-3 text-zinc-400 ${isToday ? "border-zinc-950 bg-zinc-100 ring-2 ring-zinc-950/10" : "border-zinc-200 bg-zinc-50"}`}><span className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold"}>{dayNumber}</span><p className="mt-4 text-xs">{holidayName ?? "Fin de semana"}</p></div>;
  }

  if (requestMode && requestMode !== "chooser") {
    const isOutsideSubstitutionWeek = requestMode === "substitution-target" && substitutionWeek && (date < substitutionWeek.start || date > substitutionWeek.end);
    const isPastDate = date < getMadridTodayDateKey();
    const isSubstitutionLockedDate = isDateLockedForMode(date, requestMode);
    const blockedReason = isSubstitutionLockedDate ? "Fuera de plazo" : isPastDate ? "Fecha pasada" : pending ? "Pendiente" : isOutsideSubstitutionWeek ? "Otra semana" : requestMode === "additional" && selected ? "Ya asignado" : (requestMode === "substitution-source" || requestMode === "removal") && !selected ? "Sin teletrabajo" : requestMode === "substitution-target" && selected ? "Ya asignado" : null;
    const canSelect = !blockedReason;
    const label = blockedReason ?? (requestSelected ? "Seleccionado" : requestMode === "additional" ? "Seleccionar" : "Elegir día");
    return <button aria-label={`${formatDateKeyForDisplay(date)}, ${label}`} className={`cursor-pointer min-h-24 w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 ${requestSelected ? "border-sky-500 bg-sky-100/70" : selected ? "border-emerald-500 bg-emerald-100/50" : "border-zinc-200 bg-white"} ${isToday ? "ring-2 ring-zinc-950/20" : ""} disabled:cursor-not-allowed disabled:opacity-60`} disabled={!canSelect} onClick={() => onRequestClick(date)} type="button"><div className="flex h-full flex-col justify-between gap-3"><div className="flex items-start justify-between"><span className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold text-zinc-950"}>{dayNumber}</span>{pending ? <PendingIndicator /> : null}</div><span className="rounded-lg border border-zinc-300 px-2 py-1 text-center text-xs font-medium text-zinc-700">{label}</span></div></button>;
  }

  if (!canEdit || (minimumEditableDate && date < minimumEditableDate)) {
    return <div className={`min-h-24 rounded-xl border p-3 ${selected ? "border-emerald-500 bg-emerald-100/50" : "border-zinc-200 bg-white"} ${isToday ? "ring-2 ring-zinc-950/20" : ""}`}><div className="flex h-full flex-col justify-between gap-4"><div className="flex items-start justify-between"><span className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold text-zinc-950"}>{dayNumber}</span>{pending ? <PendingIndicator /> : null}</div><p className={selected ? "text-xs font-medium text-emerald-800" : "text-xs text-zinc-500"}>{selected ? "Teletrabajo" : "Sin asignar"}</p></div></div>;
  }

  const weeklyLimitReached = enforceWeeklyAllowance && !selected && weeklyCount >= weeklyAllowance;
  return <form action={async () => onToggle?.(date, !selected)} aria-label={`${formatDateKeyForDisplay(date)}, ${selected ? "teletrabajo marcado" : "sin teletrabajo"}`} className={`min-h-24 rounded-xl border p-3 ${selected ? "border-emerald-500 bg-emerald-100/50" : "border-zinc-200 bg-white"} ${isToday ? "ring-2 ring-zinc-950/20" : ""}`}><div className="flex h-full flex-col justify-between gap-4"><div className="flex items-start justify-between"><span className={isToday ? "inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white" : "text-sm font-semibold text-zinc-950"}>{dayNumber}</span>{!selected ? <span className="text-[11px] text-zinc-500">{weeklyCount}/{weeklyAllowance}</span> : null}</div><button aria-label={`${selected ? "Quitar" : "Marcar"} teletrabajo el ${formatDateKeyForDisplay(date)}`} className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 ${selected ? "border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-50" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"}`} disabled={saving || weeklyLimitReached} title={weeklyLimitReached ? "Cupo semanal completo" : undefined} type="submit">{saving ? "Guardando…" : selected ? "Quitar" : weeklyLimitReached ? "Cupo completo" : "Marcar"}</button></div></form>;
}
