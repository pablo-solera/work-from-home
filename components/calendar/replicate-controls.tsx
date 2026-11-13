"use client";

import { useState } from "react";
import { replicateWorkFromHomeDaysAction } from "@/app/(dashboard)/calendar/actions";
import { Button } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useErrorModal } from "@/components/common/error-modal-provider";

type ReplicateControlsProps = {
  month: number;
  selectedCount: number;
  targetUserId: string;
  year: number;
};

type ReplicateScope = "next" | "untilYearEnd";

export function ReplicateControls({ month, selectedCount, targetUserId, year }: ReplicateControlsProps) {
  const { showError } = useErrorModal();
  const [pending, setPending] = useState(false);
  const [scope, setScope] = useState<ReplicateScope | null>(null);
  const disabledBySelection = selectedCount === 0;
  const nextMonthDisabled = disabledBySelection || month === 12;
  const yearEndDisabled = disabledBySelection;
  const helperText = disabledBySelection
    ? "Marca al menos un día este mes para replicar el patrón."
    : month === 12
      ? "Hasta fin de año sustituirá el patrón del mes actual. No hay un mes siguiente dentro del año."
      : "Se sustituirán los días del mes actual y de los meses afectados por este patrón semanal.";

  async function replicate() {
    if (!scope) return;
    const formData = new FormData();
    formData.set("targetUserId", targetUserId);
    formData.set("year", String(year));
    formData.set("month", String(month));
    formData.set("scope", scope);
    setScope(null);
    setPending(true);
    try {
      const result = await replicateWorkFromHomeDaysAction(formData);
      if (!result.ok) showError(result.error);
    } catch {
      showError("No se pudo replicar el patrón. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-950">Replicar patrón de teletrabajo</p>
      <p className="mt-1 text-xs text-zinc-600">{helperText}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button disabled={nextMonthDisabled || pending} onClick={() => setScope("next")} variant="secondary">{pending ? "Replicando…" : "Replicar al mes siguiente"}</Button>
        <Button disabled={yearEndDisabled || pending} onClick={() => setScope("untilYearEnd")} variant="secondary">{pending ? "Replicando…" : "Replicar hasta fin de año"}</Button>
      </div>
      {scope ? (
        <ConfirmDialog
          confirmLabel="Replicar"
          description="Se sustituirán los días de teletrabajo del mes actual y de los meses afectados por el patrón semanal seleccionado."
          onClose={() => setScope(null)}
          onConfirm={replicate}
          title="¿Replicar el patrón?"
        />
      ) : null}
    </div>
  );
}
