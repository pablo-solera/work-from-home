"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { decideAdminWfhRequestAction } from "@/app/(dashboard)/admin/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";

export function RequestDecisionForm({ requestId, adminView = false }: { requestId: string; adminView?: boolean }) {
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
        const result = await (adminView ? decideAdminWfhRequestAction(formData) : decideWfhRequestAction(formData));
        if (!result.ok) {
          const message = result.error ?? "No se pudo resolver la solicitud.";
          setError(message);
          return;
        }
        router.refresh();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "No se pudo resolver la solicitud.";
        setError(message);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
        <label className="block"><span className="sr-only">Comentario opcional</span><input aria-label="Comentario opcional" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" disabled={pending} onChange={(event) => setComment(event.target.value)} placeholder="Comentario opcional" value={comment} /></label>
      <ActionFeedback error={error} />
      <div className="flex gap-2">
        <button className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={() => decide("accepted")} type="button">{pending ? "Procesando..." : "Aceptar"}</button>
        <button className="cursor-pointer rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={() => decide("rejected")} type="button">{pending ? "Procesando..." : "Rechazar"}</button>
      </div>
    </div>
  );
}
