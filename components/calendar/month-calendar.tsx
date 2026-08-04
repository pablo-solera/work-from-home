"use client";

import { useActionState, useEffect, useState } from "react";
import { createWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { useToast } from "@/components/common/toast-provider";
import { formatDateKeyForDisplay, getMadridTodayDateKey, getWeekRange, type CalendarCell } from "@/lib/calendar/dates";
import { DayCell, type RequestMode } from "./day-cell";
import { ReplicateControls } from "./replicate-controls";
import { Dialog } from "@/components/common/dialog";
import { CalendarGrid, CalendarPanel, EmptyCalendarCell } from "./calendar-shell";

export type MonthCalendarProps = {
  canEdit: boolean;
  canRequest?: boolean;
  cells: CalendarCell[];
  monthName: string;
  selectedDates: string[];
  pendingDates?: string[];
  previousMonthHref: string;
  currentMonthHref: string;
  nextMonthHref: string;
  showCurrentMonthLink: boolean;
  targetUserId: string;
  year: number;
  month: number;
  minimumEditableDate?: string;
};

export function MonthCalendar({
  canEdit,
  canRequest = false,
  cells,
  monthName,
  selectedDates,
  pendingDates = [],
  previousMonthHref,
  currentMonthHref,
  nextMonthHref,
  showCurrentMonthLink,
  targetUserId,
  year,
  month,
  minimumEditableDate,
}: MonthCalendarProps) {
  const selected = new Set(selectedDates);
  const pending = new Set(pendingDates);
  const [mode, setMode] = useState<RequestMode | null>(null);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [replacementSource, setReplacementSource] = useState<string | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const requestDates = mode === "additional" ? additionalDates : replacementTarget ? [replacementTarget] : [];
  const canContinue = mode === "additional" ? additionalDates.length > 0 : Boolean(replacementSource && replacementTarget);
  const substitutionWeek = replacementSource ? getWeekRange(replacementSource) : undefined;

  function resetRequest() {
    setMode(null);
    setAdditionalDates([]);
    setReplacementSource(null);
    setReplacementTarget(null);
    setReviewOpen(false);
  }

  function toggleAdditionalDate(date: string) {
    setAdditionalDates((current) => current.includes(date) ? current.filter((value) => value !== date) : [...current, date].toSorted());
  }

  function handleDayClick(date: string) {
    if (date < getMadridTodayDateKey()) {
      return;
    }

    if (mode === "additional") {
      toggleAdditionalDate(date);
      return;
    }

    if (mode === "substitution-source") {
      setReplacementSource(date);
      setMode("substitution-target");
      return;
    }

    if (mode === "substitution-target") {
      setReplacementTarget(date);
    }
  }

  return (
    <CalendarPanel
      monthName={monthName}
      navigation={{ currentMonthHref, nextMonthHref, previousMonthHref, showCurrentMonthLink }}
      tools={canEdit ? <ReplicateControls month={month} selectedCount={selectedDates.length} targetUserId={targetUserId} year={year} /> : null}
    >
      <div className="mb-6 space-y-4">
        {canRequest && !mode ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-950">¿Necesitas cambiar tu planificación?</p>
                <p className="mt-1 text-xs text-sky-800">Solicita días adicionales a tu coordinador o aplica una sustitución inmediatamente.</p>
              </div>
              <button className="cursor-pointer rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800" onClick={() => setMode("chooser")} type="button">Solicitar cambio</button>
            </div>
          </div>
        ) : null}
        {canRequest && mode === "chooser" ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-950">¿Qué quieres solicitar?</p>
                <p className="mt-1 text-xs text-sky-800">Solo se pueden seleccionar días laborables de hoy en adelante.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="cursor-pointer rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100" onClick={() => setMode("additional")} type="button">Añadir días</button>
                <button className="cursor-pointer rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100" onClick={() => setMode("substitution-source")} type="button">Cambiar un día</button>
                <button className="cursor-pointer rounded-lg px-3 py-2 text-sm text-sky-800 hover:bg-sky-100" onClick={resetRequest} type="button">Cancelar</button>
              </div>
            </div>
          </div>
        ) : null}
        {canRequest && mode && mode !== "chooser" ? <SelectionBanner mode={mode} additionalCount={additionalDates.length} replacementSource={replacementSource} replacementTarget={replacementTarget} onContinue={() => setReviewOpen(true)} onCancel={resetRequest} canContinue={canContinue} /> : null}
      </div>
      <CalendarGrid label={`Calendario de ${monthName}`}>
        {cells.map((cell, index) => cell ? (
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
            minimumEditableDate={minimumEditableDate}
            pending={pending.has(cell.date)}
            requestMode={mode && mode !== "chooser" ? mode : null}
            requestSelected={additionalDates.includes(cell.date) || replacementTarget === cell.date}
            selected={selected.has(cell.date)}
            substitutionWeek={substitutionWeek}
            targetUserId={targetUserId}
            year={year}
            onRequestClick={handleDayClick}
          />
        ) : <EmptyCalendarCell index={index} key={`empty-${index}`} />)}
      </CalendarGrid>
      {canRequest && reviewOpen ? <RequestReviewModal dates={requestDates} kind={mode === "additional" ? "additional" : "substitution"} replacedDate={replacementSource} onClose={resetRequest} /> : null}
    </CalendarPanel>
  );
}

function SelectionBanner({ mode, additionalCount, replacementSource, replacementTarget, onContinue, onCancel, canContinue }: { mode: RequestMode; additionalCount: number; replacementSource: string | null; replacementTarget: string | null; onContinue: () => void; onCancel: () => void; canContinue: boolean }) {
  const text = mode === "additional" ? `${additionalCount} día(s) seleccionado(s)` : mode === "substitution-source" ? "Selecciona en el calendario el día WFH que quieres cambiar" : replacementTarget ? `${formatDateKeyForDisplay(replacementSource ?? "")} → ${formatDateKeyForDisplay(replacementTarget)}` : `Ahora selecciona un día de la misma semana que ${formatDateKeyForDisplay(replacementSource ?? "")}`;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300 bg-sky-50 p-4"><div><p className="text-sm font-semibold text-sky-950">{mode === "additional" ? "Selecciona días adicionales" : "Cambiar un día de teletrabajo"}</p><p className="mt-1 text-xs text-sky-800">{text}</p></div><div className="flex gap-2"><button className="cursor-pointer rounded-lg px-3 py-2 text-sm text-sky-800 hover:bg-sky-100" onClick={onCancel} type="button">Cancelar</button>{mode !== "substitution-source" ? <button className="cursor-pointer rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canContinue} onClick={onContinue} type="button">Revisar solicitud</button> : null}</div></div>;
}

function RequestReviewModal({ dates, kind, replacedDate, onClose }: { dates: string[]; kind: "additional" | "substitution"; replacedDate: string | null; onClose: () => void }) {
  const { showToast } = useToast();
  const [state, action, pending] = useActionState(async (previousState: { error?: string; message?: string; ok?: boolean }, formData: FormData) => {
    if (formData.get("kind") === "additional" && !String(formData.get("comment") ?? "").trim()) {
      return { error: "Debes indicar un comentario para solicitar días adicionales." };
    }

    const result = await createWfhRequestAction(previousState, formData);
    if (result.ok) {
      showToast(result.message ?? "Solicitud enviada correctamente.");
    }
    return result;
  }, {});
  const visibleDates = dates.map(formatDateKeyForDisplay).join(", ");

  useEffect(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="comment"]');
    const marker = textarea?.parentElement?.querySelector("span");

    if (!textarea || !marker) return;

    const required = kind === "additional";
    textarea.required = required;
    textarea.setAttribute("aria-required", String(required));
    marker.textContent = required ? "*" : "(opcional)";
  }, [kind]);

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state.ok]);

  return <Dialog onDismiss={onClose}><Dialog.Panel className="max-w-md"><form action={action} className="space-y-4"><div className="flex items-start justify-between gap-4"><div><Dialog.Title>Revisar solicitud</Dialog.Title><p className="mt-1 text-sm text-zinc-600">{kind === "substitution" ? "El cambio se aplicará inmediatamente y quedará registrado." : "Un administrador tendrá que aprobarla antes de aplicarla."}</p></div><Dialog.Close onClick={onClose} /></div><div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{kind === "substitution" ? <p>Cambiar <strong>{formatDateKeyForDisplay(replacedDate ?? "")}</strong> por <strong>{visibleDates}</strong></p> : <p>Días adicionales: <strong>{visibleDates}</strong></p>}</div><input name="kind" type="hidden" value={kind} /><input name="requestedDates" type="hidden" value={dates.join(",")} />{kind === "substitution" ? <input name="replacedDates" type="hidden" value={replacedDate ?? ""} /> : null}<label className="block text-sm font-medium text-zinc-800">Comentario <span className="font-normal text-zinc-500">(opcional)</span><textarea className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" name="comment" /></label>{state.error ? <p aria-live="polite" className="text-sm text-red-600">{state.error}</p> : null}{state.message ? <p aria-live="polite" className="text-sm text-emerald-700">{state.message}</p> : null}<div className="flex justify-end gap-2"><button className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={onClose} type="button">Cancelar</button><button className="cursor-pointer rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} type="submit">{pending ? "Aplicando…" : kind === "substitution" ? "Aplicar sustitución" : "Enviar solicitud"}</button></div></form></Dialog.Panel></Dialog>;
}
