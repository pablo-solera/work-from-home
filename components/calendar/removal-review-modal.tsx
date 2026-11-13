"use client";

import { useActionState, useEffect } from "react";
import { createWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import { fieldClasses } from "@/components/common/form-classes";
import { useToast } from "@/components/common/toast-provider";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import { markLocalMutation } from "@/lib/local-mutation";
import type { RequestFormState } from "@/lib/requests/request-types";

type RemovalReviewModalProps = { dates: string[]; onClose: () => void };

export function RemovalReviewModal({ dates, onClose }: RemovalReviewModalProps) {
  const { showToast } = useToast();
  const [state, action, pending] = useActionState(async (previousState: RequestFormState, formData: FormData) => {
    markLocalMutation();
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
          <Dialog.Header>
            <div>
              <Dialog.Title>Revisar anulación</Dialog.Title>
              <p className="mt-1 text-sm text-zinc-600">Los días se eliminarán inmediatamente y se avisará a tu coordinador.</p>
            </div>
          </Dialog.Header>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><p>Días a anular: <strong>{dates.map(formatDateKeyForDisplay).join(", ")}</strong></p></div>
          <input name="kind" type="hidden" value="removal" />
          <input name="requestedDates" type="hidden" value={dates.join(",")} />
          <label className="block text-sm font-medium text-zinc-800">Comentario <span className="font-normal text-zinc-600">(opcional)</span><textarea autoComplete="off" className={`${fieldClasses} mt-1 min-h-20 font-normal`} name="comment" /></label>
          <ActionFeedback error={state.error} />
          <Dialog.Actions>
            <Button disabled={pending} onClick={onClose} variant="secondary">Cancelar</Button>
            <Button disabled={pending} type="submit">{pending ? "Enviando…" : "Anular días"}</Button>
          </Dialog.Actions>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
