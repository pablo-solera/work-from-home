"use client";

import { useFormStatus } from "react-dom";
import { replicateWorkFromHomeDaysAction } from "@/app/(dashboard)/calendar/actions";

type ReplicateControlsProps = {
  month: number;
  selectedCount: number;
  targetUserId: string;
  year: number;
};

function ReplicateButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Replicando..." : label}
    </button>
  );
}

export function ReplicateControls({ month, selectedCount, targetUserId, year }: ReplicateControlsProps) {
  const disabled = selectedCount === 0 || month === 12;
  const helperText = month === 12 ? "No quedan meses en el año para replicar." : selectedCount === 0 ? "Marca al menos un día este mes para replicar el patrón." : "Se añadirá el mismo patrón semanal sin borrar días ya existentes.";

  function confirmReplication(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm("Se añadirán días de teletrabajo siguiendo el patrón semanal del mes actual. No se borrarán días existentes. ¿Continuar?")) {
      event.preventDefault();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-950">Replicar patrón de teletrabajo</p>
      <p className="mt-1 text-xs text-zinc-600">{helperText}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={replicateWorkFromHomeDaysAction} onSubmit={confirmReplication}>
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <input name="year" type="hidden" value={year} />
          <input name="month" type="hidden" value={month} />
          <input name="scope" type="hidden" value="next" />
          <ReplicateButton disabled={disabled} label="Replicar al mes siguiente" />
        </form>
        <form action={replicateWorkFromHomeDaysAction} onSubmit={confirmReplication}>
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <input name="year" type="hidden" value={year} />
          <input name="month" type="hidden" value={month} />
          <input name="scope" type="hidden" value="untilYearEnd" />
          <ReplicateButton disabled={disabled} label="Replicar hasta fin de año" />
        </form>
      </div>
    </div>
  );
}
