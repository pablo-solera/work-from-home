"use client";

import { useState, useTransition } from "react";
import { cancelWfhRequestDateAction } from "@/app/(dashboard)/requests/actions";

export function CancelRequestDateButton({ requestId, dateId, dateLabel }: { requestId: string; dateId: string; dateLabel: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("requestId", requestId);
        formData.append("dateId", dateId);
        await cancelWfhRequestDateAction(formData);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cancelar la fecha.");
      }
    });
  }

  if (confirming) {
    return <span className="flex flex-wrap items-center gap-2 text-xs"><span>¿Cancelar {dateLabel}?</span><button className="font-medium text-red-700 hover:text-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700" disabled={pending} onClick={cancel} type="button">{pending ? "Cancelando…" : "Sí, cancelar"}</button><button className="text-zinc-600 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700" disabled={pending} onClick={() => setConfirming(false)} type="button">No</button>{error ? <span className="basis-full text-red-600" role="alert">{error}</span> : null}</span>;
  }

  return <button className="text-xs font-medium text-red-700 hover:text-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700" onClick={() => setConfirming(true)} type="button">Cancelar día</button>;
}
