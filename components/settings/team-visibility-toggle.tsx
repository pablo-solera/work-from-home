"use client";

import { useId, useState, useTransition } from "react";
import { updateTeamVisibilityAction } from "@/app/(dashboard)/settings/actions";
import { ActionFeedback } from "@/components/common/action-feedback";

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
        <span className="sr-only">Visibilidad del teletrabajo del equipo</span>
        <input checked={enabled} className="sr-only" disabled={isPending} id={id} onChange={(event) => handleChange(event.currentTarget.checked)} type="checkbox" />
        <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${enabled ? "bg-zinc-950" : "bg-zinc-300"}`}>
          <span className={`size-5 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </span>
      </label>
      <ActionFeedback error={error} />
    </div>
  );
}
