"use client";

import { useId, useState, useTransition } from "react";
import { updateTeamVisibilityAction } from "@/app/(dashboard)/settings/actions";

type TeamVisibilityToggleProps = {
  initialEnabled: boolean;
};

export function TeamVisibilityToggle({ initialEnabled }: TeamVisibilityToggleProps) {
  const id = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextEnabled: boolean) {
    setEnabled(nextEnabled);
    setError(null);

    startTransition(async () => {
      try {
        await updateTeamVisibilityAction(nextEnabled);
      } catch {
        setEnabled(!nextEnabled);
        setError("No se pudo guardar el cambio. Inténtalo de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <label className="flex cursor-pointer items-center gap-3" htmlFor={id}>
        <span className="text-sm font-medium text-zinc-700">{enabled ? "Activado" : "Desactivado"}</span>
        <input checked={enabled} className="sr-only" disabled={isPending} id={id} onChange={(event) => handleChange(event.currentTarget.checked)} type="checkbox" />
        <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${enabled ? "bg-zinc-950" : "bg-zinc-300"}`}>
          <span className={`size-5 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </span>
      </label>
      {isPending ? <p className="text-xs text-zinc-500">Guardando...</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
