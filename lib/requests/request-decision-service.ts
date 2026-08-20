import type { SessionUser } from "@/lib/auth/session";
import { getAbsenceSectionsByDateStrict } from "@/lib/absences/absence-service";
import { isUserInCoordinatorTeam } from "@/lib/employees/org-service";
import type { RequestFormState } from "./request-types";
import { requestRange } from "./request-shared";
import { deleteWorkFromHomeDays, findRequestByIdWithDates, findWorkFromHomeDaysByUser, findRequesterById, insertWorkFromHomeDays, runInRequestTransaction, updateRequestDecision } from "./request-repository";

async function validateApproval(request: NonNullable<Awaited<ReturnType<typeof findRequestByIdWithDates>>>, actor: SessionUser) {
  const isAdmin = actor.role === "admin";
  if (request.status !== "pending" || (!isAdmin && request.coordinatorId !== actor.id)) throw new Error("La solicitud ya ha sido procesada o no tienes permiso para gestionarla.");
  const requester = await findRequesterById(request.requesterId);
  if (!requester || (!isAdmin && !(await isUserInCoordinatorTeam(requester.id, actor.id, requester)))) throw new Error("El empleado ya no pertenece a tu equipo.");
  const activeDates = request.dates.filter((date) => !date.cancelledAt);
  if (activeDates.length === 0) throw new Error("La solicitud no tiene fechas activas para aprobar.");
  const requestedDates = activeDates.map((date) => date.requestedDate);
  const replacedDates = activeDates.flatMap((date) => (date.replacedDate ? [date.replacedDate] : []));
  const range = requestRange([...requestedDates, ...replacedDates]);
  const absenceSections = await getAbsenceSectionsByDateStrict(range.start, range.end, [requester]);
  const absenceDates = new Set(Object.entries(absenceSections).flatMap(([date, sections]) => Object.values(sections).some((entries) => entries.some((entry) => entry.userId === requester.id)) ? [date] : []));
  if (requestedDates.some((date) => absenceDates.has(date))) throw new Error("No se puede aprobar una fecha con vacaciones, baja, ausencia u otra indisponibilidad.");
  const existingDates = new Set((await findWorkFromHomeDaysByUser(requester.id, [...requestedDates, ...replacedDates])).map((date) => date.date));
  if (request.kind === "additional" && requestedDates.some((date) => existingDates.has(date))) throw new Error("Una de las fechas solicitadas ya está marcada como teletrabajo.");
  if (request.kind === "substitution") {
    if (activeDates.some((date) => !date.replacedDate || !existingDates.has(date.replacedDate))) throw new Error("Una de las fechas a sustituir ya no está marcada como teletrabajo.");
    if (requestedDates.some((date) => existingDates.has(date))) throw new Error("Una de las nuevas fechas ya está marcada como teletrabajo.");
  }
  return requester;
}

export async function decideWfhRequest(actor: SessionUser, id: string, status: "accepted" | "rejected", comment: string | null): Promise<RequestFormState> {
  const request = await findRequestByIdWithDates(id);
  const canDecide = actor.role === "admin" ? request?.kind === "additional" : actor.role === "coordinator" && request?.kind === "substitution" && request.coordinatorId === actor.id;
  if (!request || !canDecide || request.status !== "pending") return { error: "La solicitud ya ha sido procesada o no tienes permiso para gestionarla." };
  try {
    const requester = status === "accepted" ? await validateApproval(request, actor) : await findRequesterById(request.requesterId);
    if (!requester) throw new Error("El empleado ya no existe.");
    await runInRequestTransaction(async (tx) => {
      const updated = await updateRequestDecision(tx, id, request.kind, status, comment, actor.id);
      if (updated.length === 0) throw new Error("La solicitud ya ha sido procesada.");
      if (status === "accepted") {
        const activeDates = request.dates.filter((date) => !date.cancelledAt);
        if (activeDates.length === 0) throw new Error("La solicitud no tiene fechas activas para aprobar.");
        if (request.kind === "substitution") await deleteWorkFromHomeDays(tx, requester.id, activeDates.map((date) => date.replacedDate!));
        await insertWorkFromHomeDays(tx, activeDates.map((date) => ({ userId: requester.id, date: date.requestedDate })), true);
      }
    });
    return { message: status === "accepted" ? "Solicitud aceptada." : "Solicitud rechazada.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo resolver la solicitud." };
  }
}

export async function decideWfhRequestForActor(actor: SessionUser, id: string, status: "accepted" | "rejected", comment: string | null) {
  const result = await decideWfhRequest(actor, id, status, comment);
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error ?? "No se pudo resolver la solicitud." };
}
