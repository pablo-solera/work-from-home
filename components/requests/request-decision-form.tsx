"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideWfhRequestAction } from "@/app/(dashboard)/requests/actions";

export function RequestDecisionForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(status: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", requestId);
        formData.append("status", status);
        formData.append("comment", comment);
        await decideWfhRequestAction(formData);
        window.dispatchEvent(new Event("request-counts-updated"));
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo resolver la solicitud.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
      <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" disabled={pending} onChange={(event) => setComment(event.target.value)} placeholder="Comentario opcional" value={comment} />
      {error ? <p aria-live="polite" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={() => decide("accepted")} type="button">{pending ? "Procesando..." : "Aceptar"}</button>
        <button className="cursor-pointer rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={() => decide("rejected")} type="button">{pending ? "Procesando..." : "Rechazar"}</button>
      </div>
    </div>
  );
}
