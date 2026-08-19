"use client";

import { useActionState, useEffect } from "react";
import { createWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";
import { Dialog } from "@/components/common/dialog";
import { useToast } from "@/components/common/toast-provider";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";

type RequestReviewModalProps = {
  dates: string[];
  kind: "additional" | "substitution";
  replacedDate: string | null;
  onClose: () => void;
};

export function RequestReviewModal({ dates, kind, replacedDate, onClose }: RequestReviewModalProps) {
  const { showToast } = useToast();
  const [state, action, pending] = useActionState(async (previousState: { error?: string; message?: string; ok?: boolean }, formData: FormData) => {
    if (formData.get("kind") === "additional" && !String(formData.get("comment") ?? "").trim()) {
      return { error: "Debes indicar un comentario para solicitar días adicionales." };
    }

    const result = await createWfhRequestAction(previousState, formData);
    if (result.ok) showToast(result.message ?? "Solicitud enviada correctamente.");
    return result;
  }, {});
  const visibleDates = dates.map(formatDateKeyForDisplay).join(", ");
  const commentRequired = kind === "additional";

  useEffect(() => {
    if (state.ok) onClose();
  }, [onClose, state.ok]);

  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Panel className="max-w-md">
        <form action={action} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title>Revisar solicitud</Dialog.Title>
              <p className="mt-1 text-sm text-zinc-600">{kind === "substitution" ? "El cambio se aplicará inmediatamente y quedará registrado." : "Un administrador tendrá que aprobarla antes de aplicarla."}</p>
            </div>
            <Dialog.Close onClick={onClose} />
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
            {kind === "substitution" ? <p>Cambiar <strong>{formatDateKeyForDisplay(replacedDate ?? "")}</strong> por <strong>{visibleDates}</strong></p> : <p>Días adicionales: <strong>{visibleDates}</strong></p>}
          </div>
          <input name="kind" type="hidden" value={kind} />
          <input name="requestedDates" type="hidden" value={dates.join(",")} />
          {kind === "substitution" ? <input name="replacedDates" type="hidden" value={replacedDate ?? ""} /> : null}
          <label className="block text-sm font-medium text-zinc-800">
            Comentario <span className="font-normal text-zinc-500">{commentRequired ? "*" : "(opcional)"}</span>
            <textarea aria-required={commentRequired} className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" name="comment" required={commentRequired} />
          </label>
          <ActionFeedback error={state.error} message={state.message} />
          <div className="flex justify-end gap-2">
            <button className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm" disabled={pending} onClick={onClose} type="button">Cancelar</button>
            <button className="cursor-pointer rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar solicitud"}</button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
