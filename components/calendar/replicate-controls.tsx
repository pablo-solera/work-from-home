"use client";

import { useState } from "react";
import { replicateWorkFromHomeDaysAction } from "@/app/(dashboard)/calendar/actions";
import { useErrorModal } from "@/components/common/error-modal-provider";

type ReplicateControlsProps = {
  month: number;
  selectedCount: number;
  targetUserId: string;
  year: number;
};

function ReplicateButton({ disabled, label, pending }: { disabled: boolean; label: string; pending: boolean }) {
  return (
    <button
      className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Replicando..." : label}
    </button>
  );
}

export function ReplicateControls({ month, selectedCount, targetUserId, year }: ReplicateControlsProps) {
  const { showError } = useErrorModal();
  const [pending, setPending] = useState(false);
  const disabledBySelection = selectedCount === 0;
  const nextMonthDisabled = disabledBySelection || month === 12;
  const yearEndDisabled = disabledBySelection;
  const helperText = disabledBySelection
    ? "Marca al menos un día este mes para replicar el patrón."
    : month === 12
      ? "Hasta fin de año sustituirá el patrón del mes actual. No hay un mes siguiente dentro del año."
      : "Se sustituirán los días del mes actual y de los meses afectados por este patrón semanal.";

  async function confirmReplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Se sustituirán los días de teletrabajo del mes actual y de los meses afectados por el patrón semanal seleccionado. ¿Continuar?")) {
      return;
    }
    setPending(true);
    const result = await replicateWorkFromHomeDaysAction(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) showError(result.error);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-950">Replicar patrón de teletrabajo</p>
      <p className="mt-1 text-xs text-zinc-600">{helperText}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={confirmReplication}>
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <input name="year" type="hidden" value={year} />
          <input name="month" type="hidden" value={month} />
          <input name="scope" type="hidden" value="next" />
          <ReplicateButton disabled={nextMonthDisabled} label="Replicar al mes siguiente" pending={pending} />
        </form>
        <form onSubmit={confirmReplication}>
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <input name="year" type="hidden" value={year} />
          <input name="month" type="hidden" value={month} />
          <input name="scope" type="hidden" value="untilYearEnd" />
          <ReplicateButton disabled={yearEndDisabled} label="Replicar hasta fin de año" pending={pending} />
        </form>
      </div>
    </div>
  );
}
