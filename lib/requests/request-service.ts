import type { SessionUser } from "@/lib/auth/session";
import { getAbsenceSectionsByDateStrict } from "@/lib/absences/absence-service";
import { getHolidayName, getMadridTodayDateKey, isDateInWeek, isSubstitutionLocked, isValidDateKey, isWeekendDateKey } from "@/lib/calendar/dates";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { findCoordinatorUser, isUserInCoordinatorTeam } from "@/lib/employees/org-service";
import type { RequestCursor, RequestFilters, RequestPage } from "./request-types";
import {
  acknowledgeAdminSubstitution,
  acknowledgeCoordinatorSubstitution,
  cancelRequest,
  cancelRequestDate,
  deleteWorkFromHomeDays,
  findAdminRequestsPage,
  findAdminSubstitutionNotificationsPage,
  findCoordinatorRequestsPage,
  findNotificationSummary,
  findPendingRequestDates as findPendingRequestDatesFromRepository,
  findPendingRequestsWithDates,
  findRequesterById,
  findRequester,
  findRequestByIdWithDates,
  findRequesterRequestsPage,
  findRequestWithDates,
  findWorkFromHomeDays,
  findWorkFromHomeDaysByUser,
  insertRequest,
  insertRequestDates,
  insertWorkFromHomeDays,
  lockRequest,
  lockRequestDate,
  lockUser,
  runInRequestTransaction,
  updateRequestDecision,
} from "./request-repository";

export type RequestFormState = { error?: string; message?: string; ok?: boolean };
export type RequestKind = "additional" | "substitution";

export const REQUEST_PAGE_SIZE = 10;

type RequestInput = {
  kind: RequestKind;
  requestedDates: string[];
  replacedDates: string[];
  comment: string | null;
};

function validateDates(dates: string[]) {
  const today = getMadridTodayDateKey();

  if (dates.length === 0 || dates.some((date) => !isValidDateKey(date) || date < today || isWeekendDateKey(date) || getHolidayName(date))) {
    throw new Error("Solo se pueden solicitar días laborables que no sean festivos.");
  }

  if (new Set(dates).size !== dates.length) {
    throw new Error("No puedes repetir una fecha en la misma solicitud.");
  }
}

function requestRange(dates: string[]) {
  return { start: dates.toSorted()[0], end: dates.toSorted()[dates.length - 1] };
}

async function getRequester(userId: string) {
  return findRequesterById(userId);
}

export async function createWfhRequest(user: SessionUser, input: RequestInput): Promise<RequestFormState> {
  try {
    validateDates(input.requestedDates);

    if ([...input.requestedDates, ...input.replacedDates].some((date) => isSubstitutionLocked(date))) {
      throw new Error("Fuera de plazo: después de las 10:15 no se puede seleccionar el día de hoy.");
    }

    if (input.kind === "additional" && !input.comment?.trim()) {
      throw new Error("Debes indicar un comentario para solicitar días adicionales.");
    }

    if (input.kind === "substitution") {
      if (input.replacedDates.length !== input.requestedDates.length) {
        throw new Error("Debes indicar una fecha a sustituir por cada fecha solicitada.");
      }

      validateDates(input.replacedDates);
      if (input.requestedDates.some((date, index) => !isDateInWeek(date, input.replacedDates[index]))) {
        throw new Error("El día de sustitución debe pertenecer a la misma semana que el día original.");
      }
      if (input.replacedDates.some((date, index) => date === input.requestedDates[index])) {
        throw new Error("La fecha nueva debe ser distinta de la fecha sustituida.");
      }
    }

    const requesterUser = await getRequester(user.id);
    if (!requesterUser) throw new Error("Solo usuarios activos pueden crear solicitudes.");
    const coordinator = user.role === "coordinator" ? requesterUser : await findCoordinatorUser(requesterUser);
    const absenceRange = input.kind === "substitution" ? requestRange([...input.requestedDates, ...input.replacedDates]) : null;
    const absenceSections = input.kind === "substitution"
      ? await getAbsenceSectionsByDateStrict(absenceRange!.start, absenceRange!.end, [requesterUser])
      : null;

    await runInRequestTransaction(async (tx) => {
      await lockUser(tx, user.id);
      const requester = await findRequester(tx, user.id);

      if (!requester || user.role === "admin") {
        throw new Error("Solo empleados y coordinadores pueden crear solicitudes.");
      }

      const pendingDates = await findPendingRequestDatesFromRepository(tx, user.id);
      const requestedDates = new Set(input.requestedDates);
      const affectedDates = new Set([...requestedDates, ...input.replacedDates]);
      const hasDuplicate = pendingDates.some((date) => affectedDates.has(date.requestedDate) || (date.replacedDate ? affectedDates.has(date.replacedDate) : false));

      if (hasDuplicate) {
        throw new Error("Ya existe una solicitud pendiente para una de las fechas seleccionadas.");
      }

      if (input.kind === "substitution") {
        const existingDates = await findWorkFromHomeDays(tx, user.id, [...input.requestedDates, ...input.replacedDates]);
        const existingDateSet = new Set(existingDates.map((date) => date.date));

        if (input.replacedDates.some((date) => !existingDateSet.has(date))) {
          throw new Error("Una de las fechas a sustituir ya no está marcada como teletrabajo.");
        }

        if (input.requestedDates.some((date) => existingDateSet.has(date))) {
          throw new Error("Una de las nuevas fechas ya está marcada como teletrabajo.");
        }

        const unavailableDates = new Set(
          Object.entries(absenceSections ?? {}).flatMap(([date, sections]) =>
            Object.values(sections).some((entries) => entries.some((entry) => entry.userId === user.id)) ? [date] : [],
          ),
        );

        if (input.requestedDates.some((date) => unavailableDates.has(date))) {
          throw new Error("No se puede aplicar la sustitución porque el nuevo día tiene una ausencia.");
        }

        const [request] = await insertRequest(tx, {
            requesterId: user.id,
            coordinatorId: coordinator?.id ?? null,
            kind: input.kind,
            status: "accepted",
            decisionComment: "Aplicada automáticamente por el sistema.",
            decidedAt: new Date(),
            coordinatorNotifiedAt: new Date(),
            adminNotifiedAt: user.role === "coordinator" ? new Date() : null,
          });

        await insertRequestDates(tx,
          input.requestedDates.map((requestedDate, index) => ({
            requestId: request.id,
            requestedDate,
            replacedDate: input.replacedDates[index],
          })));

        const deleted = await deleteWorkFromHomeDays(tx, user.id, input.replacedDates);

        if (deleted.length !== input.replacedDates.length) {
          throw new Error("No se pudieron sustituir todas las fechas originales.");
        }

        await insertWorkFromHomeDays(tx, input.requestedDates.map((date) => ({ userId: user.id, date })), false);
        return;
      }

      const [request] = await insertRequest(tx, {
          requesterId: user.id,
          coordinatorId: coordinator?.id ?? null,
          kind: input.kind,
          requesterComment: input.comment,
        });

      await insertRequestDates(tx,
        input.requestedDates.map((requestedDate, index) => ({
          requestId: request.id,
          requestedDate,
          replacedDate: input.kind === "substitution" ? input.replacedDates[index] : null,
        })));
    });

    return { message: input.kind === "substitution" ? "Sustitución aplicada correctamente." : "Solicitud enviada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la solicitud." };
  }
}

function decodeCursor(value: string | undefined): RequestCursor | undefined {
  if (!value) return undefined;

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<RequestCursor>;
    if (typeof decoded.createdAt !== "string" || typeof decoded.id !== "string" || !decoded.id) return undefined;
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.getTime())) return undefined;
    return { createdAt: createdAt.toISOString(), id: decoded.id };
  } catch {
    return undefined;
  }
}

function encodeCursor(request: { createdAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: request.createdAt.toISOString(), id: request.id })).toString("base64url");
}

export async function getRequestsForRequester(userId: string, filters: RequestFilters, cursorValue?: string) {
  const cursor = decodeCursor(cursorValue);
  const requests = await findRequesterRequestsPage(userId, filters, cursor, REQUEST_PAGE_SIZE + 1);

  return toRequestPage(requests);
}

function toRequestPage<T extends { id: string; createdAt: Date }>(requests: T[]): RequestPage<T> {
  const hasNextPage = requests.length > REQUEST_PAGE_SIZE;
  const page = hasNextPage ? requests.slice(0, REQUEST_PAGE_SIZE) : requests;
  const lastRequest = page.at(-1);

  return {
    requests: page,
    nextCursor: hasNextPage && lastRequest ? encodeCursor(lastRequest) : null,
  };
}

export async function getPendingRequestedDates(userId: string, start: string, end: string) {
  const requests = await findPendingRequestsWithDates(userId);

  return requests.flatMap((request) =>
    request.dates.filter((date) => !date.cancelledAt).flatMap((date) => {
      const dates = [date.requestedDate];
      if (date.replacedDate) dates.push(date.replacedDate);
      return dates.filter((value) => value >= start && value <= end);
    }),
  );
}

export type RequestNotificationSummary = {
  actionableRequestCount: number;
  informationalRequestCount: number;
  revision: string | null;
};

export async function getRequestNotificationSummary(userId: string, role: "admin" | "coordinator"): Promise<RequestNotificationSummary> {
  const [result] = await findNotificationSummary(userId, role);

  return {
    actionableRequestCount: Number(result?.actionableRequestCount ?? 0),
    informationalRequestCount: Number(result?.informationalRequestCount ?? 0),
    revision: result?.revision ? String(result.revision) : null,
  };
}

export async function markSubstitutionAsRead(coordinatorId: string, requestId: string) {
  const updated = await acknowledgeCoordinatorSubstitution(coordinatorId, requestId);
  return updated.length > 0;
}

export async function markAdminSubstitutionAsRead(requestId: string) {
  const updated = await acknowledgeAdminSubstitution(requestId);
  return updated.length > 0;
}

export async function getRequestsForCoordinator(coordinatorId: string, filters: RequestFilters, cursorValue?: string): Promise<RequestPage<Awaited<ReturnType<typeof findCoordinatorRequestsPage>>[number] & { requesterName: string; requesterEmail: string }>> {
  const cursor = decodeCursor(cursorValue);
  const requests = await findCoordinatorRequestsPage(coordinatorId, filters, cursor, REQUEST_PAGE_SIZE + 1);
  const page = toRequestPage(requests);
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));

  return {
    ...page,
    requests: page.requests.map((request) => ({
      ...request,
      requesterName: identities.get(request.requester.id)?.name ?? request.requester.fallbackName ?? "Usuario",
      requesterEmail: identities.get(request.requester.id)?.email ?? request.requester.fallbackEmail ?? "",
    })),
  };
}

export async function getRequestsForAdmin(filters: RequestFilters, cursorValue?: string) {
  const cursor = decodeCursor(cursorValue);
  const requests = await findAdminRequestsPage(filters, cursor, REQUEST_PAGE_SIZE + 1);
  const page = toRequestPage(requests);
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));

  return {
    ...page,
    requests: page.requests.map((request) => ({
      ...request,
      requesterName: identities.get(request.requesterId)?.name ?? "Usuario",
      requesterEmail: identities.get(request.requesterId)?.email ?? "",
    })),
  };
}

export async function getAdminSubstitutionNotifications(cursorValue?: string) {
  const cursor = decodeCursor(cursorValue);
  const requests = await findAdminSubstitutionNotificationsPage(cursor, REQUEST_PAGE_SIZE + 1);
  const page = toRequestPage(requests);
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));
  return { ...page, requests: page.requests.map((request) => ({ ...request, requesterName: identities.get(request.requesterId)?.name ?? "Usuario", requesterEmail: identities.get(request.requesterId)?.email ?? "" })) };
}

async function getRequestWithDates(id: string) {
  return findRequestByIdWithDates(id);
}

async function validateApproval(request: NonNullable<Awaited<ReturnType<typeof getRequestWithDates>>>, actor: SessionUser) {
  const isAdmin = actor.role === "admin";
  if (request.status !== "pending" || (!isAdmin && request.coordinatorId !== actor.id)) {
    throw new Error("La solicitud ya ha sido procesada o no tienes permiso para gestionarla.");
  }

  const requester = await getRequester(request.requesterId);
  if (!requester || (!isAdmin && !(await isUserInCoordinatorTeam(requester.id, actor.id)))) {
    throw new Error("El empleado ya no pertenece a tu equipo.");
  }

  const activeDates = request.dates.filter((date) => !date.cancelledAt);
  if (activeDates.length === 0) {
    throw new Error("La solicitud no tiene fechas activas para aprobar.");
  }
  const requestedDates = activeDates.map((date) => date.requestedDate);
  const replacedDates = activeDates.flatMap((date) => (date.replacedDate ? [date.replacedDate] : []));
  const range = requestRange([...requestedDates, ...replacedDates]);
  const absenceSections = await getAbsenceSectionsByDateStrict(range.start, range.end, [requester]);
  const absenceDates = new Set(
    Object.entries(absenceSections).flatMap(([date, sections]) =>
      Object.values(sections).some((entries) => entries.some((entry) => entry.userId === requester.id)) ? [date] : [],
    ),
  );

  if (requestedDates.some((date) => absenceDates.has(date))) {
    throw new Error("No se puede aprobar una fecha con vacaciones, baja, ausencia u otra indisponibilidad.");
  }

  const existing = await findWorkFromHomeDaysByUser(requester.id, [...requestedDates, ...replacedDates]);
  const existingDates = new Set(existing.map((date) => date.date));

  if (request.kind === "additional" && requestedDates.some((date) => existingDates.has(date))) {
    throw new Error("Una de las fechas solicitadas ya está marcada como teletrabajo.");
  }

  if (request.kind === "substitution") {
    if (activeDates.some((date) => !date.replacedDate || !existingDates.has(date.replacedDate))) {
      throw new Error("Una de las fechas a sustituir ya no está marcada como teletrabajo.");
    }
    if (requestedDates.some((date) => existingDates.has(date))) {
      throw new Error("Una de las nuevas fechas ya está marcada como teletrabajo.");
    }
  }

  return requester;
}

export async function decideWfhRequest(actor: SessionUser, id: string, status: "accepted" | "rejected", comment: string | null): Promise<RequestFormState> {
  const request = await getRequestWithDates(id);

  const canDecide = actor.role === "admin"
    ? request?.kind === "additional"
    : actor.role === "coordinator" && request?.kind === "substitution" && request.coordinatorId === actor.id;

  if (!request || !canDecide || request.status !== "pending") {
    return { error: "La solicitud ya ha sido procesada o no tienes permiso para gestionarla." };
  }

  try {
    const requester = status === "accepted" ? await validateApproval(request, actor) : await getRequester(request.requesterId);
    if (!requester) {
      throw new Error("El empleado ya no existe.");
    }

    await runInRequestTransaction(async (tx) => {
      const updated = await updateRequestDecision(tx, id, request.kind, status, comment, actor.id);

      if (updated.length === 0) {
        throw new Error("La solicitud ya ha sido procesada.");
      }

      if (status === "accepted") {
        const activeDates = request.dates.filter((date) => !date.cancelledAt);
        if (activeDates.length === 0) {
          throw new Error("La solicitud no tiene fechas activas para aprobar.");
        }

        if (request.kind === "substitution") {
          await deleteWorkFromHomeDays(tx, requester.id, activeDates.map((date) => date.replacedDate!));
        }

        await insertWorkFromHomeDays(tx, activeDates.map((date) => ({ userId: requester.id, date: date.requestedDate })), true);
      }
    });

    return { message: status === "accepted" ? "Solicitud aceptada." : "Solicitud rechazada.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo resolver la solicitud." };
  }
}

export async function cancelWfhRequestDate(actor: SessionUser, requestId: string, dateId: string): Promise<RequestFormState> {
  const request = await getRequestWithDates(requestId);
  const date = request?.dates.find((item) => item.id === dateId);

  if (!request || !date || request.requesterId !== actor.id) {
    return { error: "No puedes cancelar esta fecha." };
  }

  if (request.kind !== "additional" || request.status !== "pending") {
    return { error: "Solo se pueden cancelar solicitudes pendientes de días adicionales." };
  }

  const today = getMadridTodayDateKey();
  if (date.requestedDate <= today) {
    return { error: "Solo puedes cancelar fechas futuras." };
  }

  try {
    await runInRequestTransaction(async (tx) => {
      await lockRequest(tx, requestId);
      await lockUser(tx, actor.id);
      await lockRequestDate(tx, requestId, dateId);

      const currentRequest = await findRequestWithDates(tx, requestId);
      const currentDate = currentRequest?.dates.find((item) => item.id === dateId);

      if (!currentRequest || !currentDate || currentRequest.requesterId !== actor.id || currentDate.cancelledAt) {
        throw new Error("Esta fecha ya no está disponible para cancelar.");
      }

      if (currentRequest.kind !== "additional" || currentRequest.status !== "pending") {
        throw new Error("Solo se pueden cancelar solicitudes pendientes de días adicionales.");
      }

      if (currentDate.requestedDate <= today) {
        throw new Error("Solo puedes cancelar fechas futuras.");
      }

      await cancelRequestDate(tx, dateId, actor.id);

      const remaining = currentRequest.dates.filter((item) => item.id !== dateId && !item.cancelledAt);
      if (remaining.length === 0) {
        await cancelRequest(tx, requestId);
      }
    });

    return { message: "Fecha cancelada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cancelar la fecha." };
  }
}
