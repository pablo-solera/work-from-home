import type { SessionUser } from "@/lib/auth/session";
import { getMadridTodayDateKey } from "@/lib/calendar/dates";
import type { RequestFormState } from "./request-types";
import { cancelRequest, cancelRequestDate, findRequestByIdWithDates, lockRequestAndDateForCancellation, lockUser, runInRequestTransaction } from "./request-repository";

export async function cancelWfhRequestDate(actor: SessionUser, requestId: string, dateId: string): Promise<RequestFormState> {
  const request = await findRequestByIdWithDates(requestId);
  const date = request?.dates.find((item) => item.id === dateId);
  if (!request || !date || request.requesterId !== actor.id) return { error: "No puedes cancelar esta fecha." };
  if (request.kind !== "additional" || request.status !== "pending") return { error: "Solo se pueden cancelar solicitudes pendientes de días adicionales." };
  const today = getMadridTodayDateKey();
  if (date.requestedDate <= today) return { error: "Solo puedes cancelar fechas futuras." };
  try {
    await runInRequestTransaction(async (tx) => {
      await lockUser(tx, actor.id);
      const [lockedDate] = await lockRequestAndDateForCancellation(tx, requestId, dateId) as unknown as Array<{
        active_dates_remaining: string | number;
        cancelled_at: Date | null;
        kind: string;
        requester_id: string;
        requested_date: string;
        status: string;
      }>;
      if (!lockedDate || lockedDate.requester_id !== actor.id || lockedDate.cancelled_at) throw new Error("Esta fecha ya no está disponible para cancelar.");
      if (lockedDate.kind !== "additional" || lockedDate.status !== "pending") throw new Error("Solo se pueden cancelar solicitudes pendientes de días adicionales.");
      if (lockedDate.requested_date <= today) throw new Error("Solo puedes cancelar fechas futuras.");
      await cancelRequestDate(tx, dateId, actor.id);
      if (Number(lockedDate.active_dates_remaining) === 0) await cancelRequest(tx, requestId);
    });
    return { message: "Fecha cancelada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cancelar la fecha." };
  }
}
