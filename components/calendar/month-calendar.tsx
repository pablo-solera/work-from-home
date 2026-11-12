"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toggleWorkFromHomeDayAction } from "@/app/(dashboard)/calendar/actions";
import { useErrorModal } from "@/components/common/error-modal-provider";
import { Button } from "@/components/common/button";
import { formatDateKeyForDisplay, getMadridTodayDateKey, getWeekRange, type CalendarCell } from "@/lib/calendar/dates";
import { DayCell, isDateLockedForMode, type RequestMode } from "./day-cell";
import { RemovalReviewModal } from "./removal-review-modal";
import { ReplicateControls } from "./replicate-controls";
import { RequestReviewModal } from "./request-review-modal";
import { CalendarGrid, CalendarPanel, EmptyCalendarCell, PERSONAL_LEGEND } from "./calendar-shell";

const EMPTY_SELECTION: string[] = [];

export type MonthCalendarProps = {
  canEdit: boolean;
  canRequest?: boolean;
  cells: CalendarCell[];
  monthName: string;
  selectedDates: string[];
  weeklyAllowance?: number;
  weeklyCounts?: Record<string, number>;
  enforceWeeklyAllowance?: boolean;
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
  selectedDates = EMPTY_SELECTION,
  weeklyAllowance,
  weeklyCounts,
  enforceWeeklyAllowance = true,
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
  const [optimisticSelectedDates, updateOptimisticSelectedDates] = useOptimistic(selectedDates, (current: string[], update: { date: string; enabled: boolean }) => update.enabled ? [...new Set([...current, update.date])].toSorted() : current.filter((date) => date !== update.date));
  const optimisticSelected = useMemo(() => new Set(optimisticSelectedDates), [optimisticSelectedDates]);
  const [, startTransition] = useTransition();
  const { showError } = useErrorModal();
  const [mode, setMode] = useState<RequestMode | null>(null);
  const [savingDates, setSavingDates] = useState<string[]>([]);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [replacementSource, setReplacementSource] = useState<string | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const pending = useMemo(() => new Set(pendingDates), [pendingDates]);
  const saving = useMemo(() => new Set(savingDates), [savingDates]);
  const additionalDateSet = useMemo(() => new Set(additionalDates), [additionalDates]);
  const weekStartByDate = useMemo(() => new Map(cells.flatMap((cell) => cell ? [[cell.date, getWeekRange(cell.date).start] as const] : [])), [cells]);

  const requestDates = mode === "additional" || mode === "removal" ? additionalDates : replacementTarget ? [replacementTarget] : [];
  const canContinue = mode === "additional" || mode === "removal" ? additionalDates.length > 0 : Boolean(replacementSource && replacementTarget);
  const substitutionWeek = useMemo(() => replacementSource ? getWeekRange(replacementSource) : undefined, [replacementSource]);
  const navigation = useMemo(() => ({ currentMonthHref, nextMonthHref, previousMonthHref, showCurrentMonthLink }), [currentMonthHref, nextMonthHref, previousMonthHref, showCurrentMonthLink]);
  const formDataFactory = useMemo(() => (date: string, enabled: boolean) => {
    const formData = new FormData();
    formData.set("date", date);
    formData.set("enabled", String(enabled));
    formData.set("targetUserId", targetUserId);
    formData.set("sourcePath", window.location.pathname);
    return formData;
  }, [targetUserId]);

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

  function toggleWorkFromHomeDay(date: string, enabled: boolean) {
    const formData = formDataFactory(date, enabled);
    setSavingDates((current) => [...current, date]);
    startTransition(async () => {
      try {
        updateOptimisticSelectedDates({ date, enabled });
        const result = await toggleWorkFromHomeDayAction(formData);
        if (!result.ok) {
          updateOptimisticSelectedDates({ date, enabled: !enabled });
          showError(result.error);
        }
      } catch {
        updateOptimisticSelectedDates({ date, enabled: !enabled });
        showError("No se pudo actualizar el día. Inténtalo de nuevo.");
      } finally {
        setSavingDates((current) => current.filter((value) => value !== date));
      }
    });
  }

  function handleDayClick(date: string) {
    if (date < getMadridTodayDateKey() || isDateLockedForMode(date, mode)) {
      return;
    }

    if (mode === "additional") {
      toggleAdditionalDate(date);
      return;
    }

    if (mode === "removal") {
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
      legend={PERSONAL_LEGEND}
      monthName={monthName}
      navigation={navigation}
      tools={canEdit ? <ReplicateControls month={month} selectedCount={selectedDates.length} targetUserId={targetUserId} year={year} /> : null}
    >
      <div className="mb-6 space-y-4">
        {canRequest && !mode ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-950">¿Necesitas cambiar tu planificación?</p>
                <p className="mt-1 text-xs text-sky-900">Solicita días adicionales a tu coordinador o aplica una sustitución inmediatamente.</p>
              </div>
              <Button className="bg-sky-700 hover:bg-sky-800" onClick={() => setMode("chooser")}>Solicitar cambio</Button>
            </div>
          </div>
        ) : null}
        {canRequest && mode === "chooser" ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-950">¿Qué quieres solicitar?</p>
                <p className="mt-1 text-xs text-sky-900">Solo se pueden seleccionar días laborables de hoy en adelante.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="border-sky-300 text-sky-950 hover:bg-sky-100" onClick={() => setMode("additional")} variant="secondary">Añadir días</Button>
                <Button className="border-sky-300 text-sky-950 hover:bg-sky-100" onClick={() => setMode("removal")} variant="secondary">Anular días</Button>
                <Button className="border-sky-300 text-sky-950 hover:bg-sky-100" onClick={() => setMode("substitution-source")} variant="secondary">Sustituir un día</Button>
                <Button className="text-sky-900 hover:bg-sky-100" onClick={resetRequest} variant="ghost">Cancelar</Button>
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
              saving={saving.has(cell.date)}
            requestMode={mode && mode !== "chooser" ? mode : null}
            requestSelected={additionalDateSet.has(cell.date) || replacementTarget === cell.date}
             selected={optimisticSelected.has(cell.date)}
              weeklyAllowance={weeklyAllowance}
              weeklyCount={weeklyCounts?.[weekStartByDate.get(cell.date) ?? ""] ?? 0}
              enforceWeeklyAllowance={enforceWeeklyAllowance}
            substitutionWeek={substitutionWeek}
            targetUserId={targetUserId}
            year={year}
             onRequestClick={handleDayClick}
             onToggle={toggleWorkFromHomeDay}
          />
        ) : <EmptyCalendarCell index={index} key={`empty-${index}`} />)}
      </CalendarGrid>
        {canRequest && reviewOpen ? mode === "removal" ? <RemovalReviewModal dates={requestDates} onClose={resetRequest} /> : <RequestReviewModal dates={requestDates} kind={mode === "additional" ? "additional" : "substitution"} replacedDate={replacementSource} onClose={resetRequest} /> : null}
    </CalendarPanel>
  );
}

function SelectionBanner({ mode, additionalCount, replacementSource, replacementTarget, onContinue, onCancel, canContinue }: { mode: RequestMode; additionalCount: number; replacementSource: string | null; replacementTarget: string | null; onContinue: () => void; onCancel: () => void; canContinue: boolean }) {
  const text = mode === "additional" || mode === "removal" ? `${additionalCount} día(s) seleccionado(s)` : mode === "substitution-source" ? "Selecciona en el calendario el día WFH que quieres cambiar" : replacementTarget ? `${formatDateKeyForDisplay(replacementSource ?? "")} → ${formatDateKeyForDisplay(replacementTarget)}` : `Ahora selecciona un día de la misma semana que ${formatDateKeyForDisplay(replacementSource ?? "")}`;
  const title = mode === "additional" ? "Selecciona días adicionales" : mode === "removal" ? "Selecciona días para anular" : "Sustituir un día de teletrabajo";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300 bg-sky-50 p-4">
      <div>
        <p className="text-sm font-semibold text-sky-950">{title}</p>
        <p className="mt-1 text-xs text-sky-900">{text}</p>
      </div>
      <div className="flex gap-2">
        <Button className="text-sky-900 hover:bg-sky-100" onClick={onCancel} variant="ghost">Cancelar</Button>
        {mode !== "substitution-source" ? <Button className="bg-sky-700 hover:bg-sky-800" disabled={!canContinue} onClick={onContinue}>Revisar solicitud</Button> : null}
      </div>
    </div>
  );
}
