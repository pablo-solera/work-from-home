"use client";

import { useActionState, useEffect } from "react";
import { createWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";
import { Dialog } from "@/components/common/dialog";
import { useToast } from "@/components/common/toast-provider";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import type { RequestFormState } from "@/lib/requests/request-types";

type RemovalReviewModalProps = { dates: string[]; onClose: () => void };

export function RemovalReviewModal({ dates, onClose }: RemovalReviewModalProps) {
  const { showToast } = useToast();
  const [state, action, pending] = useActionState(async (previousState: RequestFormState, formData: FormData) => {
    const result = await createWfhRequestAction(previousState, formData);
    if (result.ok) showToast(result.message ?? "Anulación aplicada correctamente.");
    return result;
  }, {});

  useEffect(() => {
    if (state.ok) onClose();
  }, [onClose, state.ok]);

  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Panel className="max-w-md">
        <form action={action} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title>Revisar anulación</Dialog.Title>
              <p className="mt-1 text-sm text-zinc-600">Los días se eliminarán inmediatamente y se avisará a tu coordinador.</p>
            </div>
            <Dialog.Close onClick={onClose} />
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><p>Días a anular: <strong>{dates.map(formatDateKeyForDisplay).join(", ")}</strong></p></div>
          <input name="kind" type="hidden" value="removal" />
          <input name="requestedDates" type="hidden" value={dates.join(",")} />
          <label className="block text-sm font-medium text-zinc-800">Comentario <span className="font-normal text-zinc-500">(opcional)</span><textarea className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" name="comment" /></label>
          <ActionFeedback error={state.error} />
          <div className="flex justify-end gap-2">
            <button className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm" disabled={pending} onClick={onClose} type="button">Cancelar</button>
            <button className="cursor-pointer rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Enviando…" : "Anular días"}</button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
