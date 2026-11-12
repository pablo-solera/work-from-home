"use client";

import { useState, useTransition } from "react";
import { decideWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { decideAdminWfhRequestAction } from "@/app/(dashboard)/admin/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";
import { Button } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { fieldClasses } from "@/components/common/form-classes";
import { markLocalMutation } from "@/lib/local-mutation";

export function RequestDecisionForm({ requestId, adminView = false }: { requestId: string; adminView?: boolean }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [pending, startTransition] = useTransition();

  function decide(status: "accepted" | "rejected") {
    setError(null);
    setConfirmingReject(false);
    markLocalMutation();
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
        // The server action revalidates the affected pages, so no router.refresh() is needed.
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "No se pudo resolver la solicitud.";
        setError(message);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
      <label className="block"><span className="sr-only">Comentario opcional</span><input autoComplete="off" name="comment" className={fieldClasses} disabled={pending} onChange={(event) => setComment(event.target.value)} placeholder="Comentario opcional…" value={comment} /></label>
      <ActionFeedback error={error} />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => decide("accepted")} variant="success">{pending ? "Procesando…" : "Aceptar"}</Button>
        <Button disabled={pending} onClick={() => setConfirmingReject(true)} variant="danger">{pending ? "Procesando…" : "Rechazar"}</Button>
      </div>
      {confirmingReject ? (
        <ConfirmDialog
          confirmLabel="Sí, rechazar"
          description="El solicitante verá el rechazo y el comentario que hayas escrito."
          onClose={() => setConfirmingReject(false)}
          onConfirm={() => decide("rejected")}
          title="¿Rechazar esta solicitud?"
          tone="danger"
        />
      ) : null}
    </div>
  );
}
