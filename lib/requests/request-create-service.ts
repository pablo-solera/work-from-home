import type { SessionUser } from "@/lib/auth/session";
import { getAbsenceSectionsByDateStrict } from "@/lib/absences/absence-service";
import { getHolidayName, getMadridTodayDateKey, isDateInWeek, isSubstitutionLocked, isValidDateKey, isWeekendDateKey } from "@/lib/calendar/dates";
import { findCoordinatorUser } from "@/lib/employees/org-service";
import type { RequestFormState, RequestKind } from "./request-types";
import { requestRange } from "./request-shared";
import { deleteWorkFromHomeDays, findPendingRequestDates as findPendingRequestDatesFromRepository, findRequesterById, findRequesterId, findWorkFromHomeDays, insertRequest, insertRequestDates, insertWorkFromHomeDays, lockUser, runInRequestTransaction } from "./request-repository";

type RequestInput = { kind: RequestKind; requestedDates: string[]; replacedDates: string[]; comment: string | null };

function validateDates(dates: string[]) {
  const today = getMadridTodayDateKey();
  if (dates.length === 0 || dates.some((date) => !isValidDateKey(date) || date < today || isWeekendDateKey(date) || getHolidayName(date))) {
    throw new Error("Solo se pueden solicitar días laborables que no sean festivos.");
  }
  if (new Set(dates).size !== dates.length) throw new Error("No puedes repetir una fecha en la misma solicitud.");
}

export async function createWfhRequest(user: SessionUser, input: RequestInput): Promise<RequestFormState> {
  try {
    validateDates(input.requestedDates);
    if ([...input.requestedDates, ...input.replacedDates].some((date) => isSubstitutionLocked(date))) throw new Error("Fuera de plazo: después de las 10:15 no se puede seleccionar el día de hoy.");
    if (input.kind === "additional" && !input.comment?.trim()) throw new Error("Debes indicar un comentario para solicitar días adicionales.");

    if (input.kind === "substitution") {
      if (input.replacedDates.length !== input.requestedDates.length) throw new Error("Debes indicar una fecha a sustituir por cada fecha solicitada.");
      validateDates(input.replacedDates);
      if (input.requestedDates.some((date, index) => !isDateInWeek(date, input.replacedDates[index]))) throw new Error("El día de sustitución debe pertenecer a la misma semana que el día original.");
      if (input.replacedDates.some((date, index) => date === input.requestedDates[index])) throw new Error("La fecha nueva debe ser distinta de la fecha sustituida.");
    }

    const requesterUser = await findRequesterById(user.id);
    if (!requesterUser) throw new Error("Solo usuarios activos pueden crear solicitudes.");
    const absenceRange = input.kind === "substitution" ? requestRange([...input.requestedDates, ...input.replacedDates]) : null;
    const [coordinator, absenceSections] = await Promise.all([
      user.role === "coordinator" ? Promise.resolve(requesterUser) : findCoordinatorUser(requesterUser),
      input.kind === "substitution" ? getAbsenceSectionsByDateStrict(absenceRange!.start, absenceRange!.end, [requesterUser]) : Promise.resolve(null),
    ]);

    const requestId = await runInRequestTransaction(async (tx) => {
      await lockUser(tx, user.id);
      const requester = await findRequesterId(tx, user.id);
      if (!requester || user.role === "admin") throw new Error("Solo empleados y coordinadores pueden crear solicitudes.");
      const pendingDates = await findPendingRequestDatesFromRepository(tx, user.id);
      const requestedDates = new Set(input.requestedDates);
      const affectedDates = new Set([...requestedDates, ...input.replacedDates]);
      if (pendingDates.some((date) => affectedDates.has(date.requestedDate) || (date.replacedDate ? affectedDates.has(date.replacedDate) : false))) throw new Error("Ya existe una solicitud pendiente para una de las fechas seleccionadas.");

      if (input.kind === "substitution") {
        const existingDates = await findWorkFromHomeDays(tx, user.id, [...input.requestedDates, ...input.replacedDates]);
        const existingDateSet = new Set(existingDates.map((date) => date.date));
        if (input.replacedDates.some((date) => !existingDateSet.has(date))) throw new Error("Una de las fechas a sustituir ya no está marcada como teletrabajo.");
        if (input.requestedDates.some((date) => existingDateSet.has(date))) throw new Error("Una de las nuevas fechas ya está marcada como teletrabajo.");
        const unavailableDates = new Set(Object.entries(absenceSections ?? {}).flatMap(([date, sections]) => Object.values(sections).some((entries) => entries.some((entry) => entry.userId === user.id)) ? [date] : []));
        if (input.requestedDates.some((date) => unavailableDates.has(date))) throw new Error("No se puede aplicar la sustitución porque el nuevo día tiene una ausencia.");
        const [request] = await insertRequest(tx, { requesterId: user.id, coordinatorId: coordinator?.id ?? null, kind: input.kind, status: "accepted", decisionComment: "Aplicada automáticamente por el sistema.", decidedAt: new Date(), coordinatorNotifiedAt: new Date(), adminNotifiedAt: user.role === "coordinator" ? new Date() : null });
        await insertRequestDates(tx, input.requestedDates.map((requestedDate, index) => ({ requestId: request.id, requestedDate, replacedDate: input.replacedDates[index] })));
        const deleted = await deleteWorkFromHomeDays(tx, user.id, input.replacedDates);
        if (deleted.length !== input.replacedDates.length) throw new Error("No se pudieron sustituir todas las fechas originales.");
        await insertWorkFromHomeDays(tx, input.requestedDates.map((date) => ({ userId: user.id, date })), false);
        return request.id;
      }

      if (input.kind === "removal") {
        const existingDates = await findWorkFromHomeDays(tx, user.id, input.requestedDates);
        if (existingDates.length !== input.requestedDates.length) throw new Error("Una de las fechas que quieres anular ya no está marcada como teletrabajo.");
        const [request] = await insertRequest(tx, { requesterId: user.id, coordinatorId: coordinator?.id ?? null, kind: input.kind, status: "accepted", requesterComment: input.comment, decisionComment: "Aplicada automáticamente por el sistema.", decidedAt: new Date(), coordinatorNotifiedAt: new Date() });
        await insertRequestDates(tx, input.requestedDates.map((requestedDate) => ({ requestId: request.id, requestedDate })));
        const deleted = await deleteWorkFromHomeDays(tx, user.id, input.requestedDates);
        if (deleted.length !== input.requestedDates.length) throw new Error("No se pudieron anular todas las fechas seleccionadas.");
        return request.id;
      }

      const [request] = await insertRequest(tx, { requesterId: user.id, coordinatorId: coordinator?.id ?? null, kind: input.kind, requesterComment: input.comment });
      await insertRequestDates(tx, input.requestedDates.map((requestedDate, index) => ({ requestId: request.id, requestedDate, replacedDate: input.kind === "substitution" ? input.replacedDates[index] : null })));
      return request.id;
    });

    return { message: input.kind === "substitution" ? "Sustitución aplicada correctamente." : input.kind === "removal" ? "Anulación aplicada correctamente." : "Solicitud enviada correctamente.", ok: true, requestId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la solicitud." };
  }
}
