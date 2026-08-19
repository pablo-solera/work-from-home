import type { SessionUser } from "@/lib/auth/session";
import { getMadridTodayDateKey } from "@/lib/calendar/dates";
import type { RequestFormState } from "./request-types";
import { cancelRequest, cancelRequestDate, findRequestByIdWithDates, findRequestWithDates, lockRequest, lockRequestDate, lockUser, runInRequestTransaction } from "./request-repository";

export async function cancelWfhRequestDate(actor: SessionUser, requestId: string, dateId: string): Promise<RequestFormState> {
  const request = await findRequestByIdWithDates(requestId);
  const date = request?.dates.find((item) => item.id === dateId);
  if (!request || !date || request.requesterId !== actor.id) return { error: "No puedes cancelar esta fecha." };
  if (request.kind !== "additional" || request.status !== "pending") return { error: "Solo se pueden cancelar solicitudes pendientes de días adicionales." };
  const today = getMadridTodayDateKey();
  if (date.requestedDate <= today) return { error: "Solo puedes cancelar fechas futuras." };
  try {
    await runInRequestTransaction(async (tx) => {
      await lockRequest(tx, requestId);
      await lockUser(tx, actor.id);
      await lockRequestDate(tx, requestId, dateId);
      const currentRequest = await findRequestWithDates(tx, requestId);
      const currentDate = currentRequest?.dates.find((item) => item.id === dateId);
      if (!currentRequest || !currentDate || currentRequest.requesterId !== actor.id || currentDate.cancelledAt) throw new Error("Esta fecha ya no está disponible para cancelar.");
      if (currentRequest.kind !== "additional" || currentRequest.status !== "pending") throw new Error("Solo se pueden cancelar solicitudes pendientes de días adicionales.");
      if (currentDate.requestedDate <= today) throw new Error("Solo puedes cancelar fechas futuras.");
      await cancelRequestDate(tx, dateId, actor.id);
      if (currentRequest.dates.filter((item) => item.id !== dateId && !item.cancelledAt).length === 0) await cancelRequest(tx, requestId);
    });
    return { message: "Fecha cancelada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cancelar la fecha." };
  }
}
