import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, wfhChangeRequestDates, wfhChangeRequests, workFromHomeDays } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { getAbsenceSectionsByDateStrict } from "@/lib/absences/absence-service";
import { getHolidayName, getMadridTodayDateKey, getRequestDateRange, isDateInWeek, isValidDateKey, isWeekendDateKey, type RequestDateFilter } from "@/lib/calendar/dates";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { findCoordinatorUser, isUserInCoordinatorTeam } from "@/lib/employees/org-service";

export type RequestFormState = { error?: string; message?: string; ok?: boolean };
export type RequestKind = "additional" | "substitution";
export type RequestStatusFilter = "all" | "pending" | "accepted" | "rejected" | "cancelled";
export type RequestFilters = { date: RequestDateFilter; status: RequestStatusFilter };
export type RequestCursor = { createdAt: string; id: string };
export type RequestPage<T> = { requests: T[]; nextCursor: string | null };

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
  return getDb().query.users.findFirst({ where: eq(users.id, userId) });
}

export async function createWfhRequest(user: SessionUser, input: RequestInput): Promise<RequestFormState> {
  try {
    validateDates(input.requestedDates);

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

    const db = getDb();
    const requesterUser = await getRequester(user.id);
    if (!requesterUser) throw new Error("Solo usuarios activos pueden crear solicitudes.");
    const coordinator = user.role === "coordinator" ? requesterUser : await findCoordinatorUser(requesterUser);

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`);
      const requester = await tx.query.users.findFirst({ where: eq(users.id, user.id) });

      if (!requester || user.role === "admin") {
        throw new Error("Solo empleados y coordinadores pueden crear solicitudes.");
      }

      const pendingDates = await tx
        .select({ requestedDate: wfhChangeRequestDates.requestedDate, replacedDate: wfhChangeRequestDates.replacedDate })
        .from(wfhChangeRequestDates)
        .innerJoin(wfhChangeRequests, eq(wfhChangeRequestDates.requestId, wfhChangeRequests.id))
        .where(and(eq(wfhChangeRequests.requesterId, user.id), eq(wfhChangeRequests.status, "pending"), sql`${wfhChangeRequestDates.cancelledAt} IS NULL`));
      const requestedDates = new Set(input.requestedDates);
      const affectedDates = new Set([...requestedDates, ...input.replacedDates]);
      const hasDuplicate = pendingDates.some((date) => affectedDates.has(date.requestedDate) || (date.replacedDate ? affectedDates.has(date.replacedDate) : false));

      if (hasDuplicate) {
        throw new Error("Ya existe una solicitud pendiente para una de las fechas seleccionadas.");
      }

      if (input.kind === "substitution") {
        const existingDates = await tx.query.workFromHomeDays.findMany({
          where: and(eq(workFromHomeDays.userId, user.id), inArray(workFromHomeDays.date, [...input.requestedDates, ...input.replacedDates])),
        });
        const existingDateSet = new Set(existingDates.map((date) => date.date));

        if (input.replacedDates.some((date) => !existingDateSet.has(date))) {
          throw new Error("Una de las fechas a sustituir ya no está marcada como teletrabajo.");
        }

        if (input.requestedDates.some((date) => existingDateSet.has(date))) {
          throw new Error("Una de las nuevas fechas ya está marcada como teletrabajo.");
        }

        const range = requestRange([...input.requestedDates, ...input.replacedDates]);
        const absenceSections = await getAbsenceSectionsByDateStrict(range.start, range.end, [requester]);
        const unavailableDates = new Set(
          Object.entries(absenceSections).flatMap(([date, sections]) =>
            Object.values(sections).some((entries) => entries.some((entry) => entry.userId === user.id)) ? [date] : [],
          ),
        );

        if (input.requestedDates.some((date) => unavailableDates.has(date))) {
          throw new Error("No se puede aplicar la sustitución porque el nuevo día tiene una ausencia.");
        }

        const [request] = await tx
          .insert(wfhChangeRequests)
          .values({
            requesterId: user.id,
            coordinatorId: coordinator?.id ?? null,
            kind: input.kind,
            status: "accepted",
            decisionComment: "Aplicada automáticamente por el sistema.",
            decidedAt: new Date(),
            coordinatorNotifiedAt: new Date(),
            adminNotifiedAt: user.role === "coordinator" ? new Date() : null,
          })
          .returning({ id: wfhChangeRequests.id });

        await tx.insert(wfhChangeRequestDates).values(
          input.requestedDates.map((requestedDate, index) => ({
            requestId: request.id,
            requestedDate,
            replacedDate: input.replacedDates[index],
          })),
        );

        const deleted = await tx
          .delete(workFromHomeDays)
          .where(and(eq(workFromHomeDays.userId, user.id), inArray(workFromHomeDays.date, input.replacedDates)))
          .returning({ id: workFromHomeDays.id });

        if (deleted.length !== input.replacedDates.length) {
          throw new Error("No se pudieron sustituir todas las fechas originales.");
        }

        await tx.insert(workFromHomeDays).values(input.requestedDates.map((date) => ({ userId: user.id, date })));
        return;
      }

      const [request] = await tx
        .insert(wfhChangeRequests)
        .values({
          requesterId: user.id,
          coordinatorId: coordinator?.id ?? null,
          kind: input.kind,
          requesterComment: input.comment,
        })
        .returning({ id: wfhChangeRequests.id });

      await tx.insert(wfhChangeRequestDates).values(
        input.requestedDates.map((requestedDate, index) => ({
          requestId: request.id,
          requestedDate,
          replacedDate: input.kind === "substitution" ? input.replacedDates[index] : null,
        })),
      );
    });

    return { message: input.kind === "substitution" ? "Sustitución aplicada correctamente." : "Solicitud enviada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la solicitud." };
  }
}

function requestWhere(filters: RequestFilters, userColumn: typeof wfhChangeRequests.requesterId | typeof wfhChangeRequests.coordinatorId, userId: string) {
  const conditions = [eq(userColumn, userId)];

  if (filters.status !== "all") {
    conditions.push(eq(wfhChangeRequests.status, filters.status));
  }

  if (filters.date !== "all") {
    const range = getRequestDateRange(filters.date);
    const matchingRequests = getDb()
      .select({ requestId: wfhChangeRequestDates.requestId })
      .from(wfhChangeRequestDates)
      .where(and(gte(wfhChangeRequestDates.requestedDate, range.start), lte(wfhChangeRequestDates.requestedDate, range.end), sql`${wfhChangeRequestDates.cancelledAt} IS NULL`));
    conditions.push(inArray(wfhChangeRequests.id, matchingRequests));
  }

  return and(...conditions);
}

function adminRequestWhere(filters: RequestFilters) {
  const conditions = [eq(wfhChangeRequests.kind, "additional")];

  if (filters.status !== "all") {
    conditions.push(eq(wfhChangeRequests.status, filters.status));
  }

  if (filters.date !== "all") {
    const range = getRequestDateRange(filters.date);
    const matchingRequests = getDb()
      .select({ requestId: wfhChangeRequestDates.requestId })
      .from(wfhChangeRequestDates)
      .where(and(gte(wfhChangeRequestDates.requestedDate, range.start), lte(wfhChangeRequestDates.requestedDate, range.end), sql`${wfhChangeRequestDates.cancelledAt} IS NULL`));
    conditions.push(inArray(wfhChangeRequests.id, matchingRequests));
  }

  return and(...conditions);
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

function requestPageWhere(
  filters: RequestFilters,
  userColumn: typeof wfhChangeRequests.requesterId | typeof wfhChangeRequests.coordinatorId,
  userId: string,
  cursor?: RequestCursor,
) {
  const baseWhere = requestWhere(filters, userColumn, userId);
  if (!cursor) return baseWhere;

  return and(
    baseWhere,
    sql`(${wfhChangeRequests.createdAt} < ${cursor.createdAt} OR (${wfhChangeRequests.createdAt} = ${cursor.createdAt} AND ${wfhChangeRequests.id} < ${cursor.id}))`,
  );
}

export async function getRequestsForRequester(userId: string, filters: RequestFilters, cursorValue?: string) {
  const cursor = decodeCursor(cursorValue);
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: requestPageWhere(filters, wfhChangeRequests.requesterId, userId, cursor),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit: REQUEST_PAGE_SIZE + 1,
    with: { dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) } },
  });

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
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: and(eq(wfhChangeRequests.requesterId, userId), eq(wfhChangeRequests.status, "pending")),
    with: { dates: true },
  });

  return requests.flatMap((request) =>
    request.dates.filter((date) => !date.cancelledAt).flatMap((date) => {
      const dates = [date.requestedDate];
      if (date.replacedDate) dates.push(date.replacedDate);
      return dates.filter((value) => value >= start && value <= end);
    }),
  );
}

export async function getPendingRequestCountForCoordinator(coordinatorId: string) {
  const summary = await getRequestNotificationSummary(coordinatorId, "coordinator");
  return summary.informationalRequestCount;
}

export async function getUnreadAutomaticSubstitutionCount(coordinatorId: string) {
  const summary = await getRequestNotificationSummary(coordinatorId, "coordinator");
  return summary.informationalRequestCount;
}

export type RequestNotificationSummary = {
  actionableRequestCount: number;
  informationalRequestCount: number;
  revision: string | null;
};

export async function getRequestNotificationSummary(userId: string, role: "admin" | "coordinator"): Promise<RequestNotificationSummary> {
  const [result] = await getDb()
    .select({
      actionableRequestCount: role === "admin"
        ? sql<number>`count(*) filter (where ${wfhChangeRequests.kind} = 'additional' and ${wfhChangeRequests.status} = 'pending')`
        : sql<number>`0`,
      informationalRequestCount: role === "coordinator"
        ? sql<number>`count(*) filter (where ${wfhChangeRequests.kind} = 'additional' and ${wfhChangeRequests.status} = 'pending') + count(*) filter (where ${wfhChangeRequests.kind} = 'substitution' and ${wfhChangeRequests.coordinatorNotifiedAt} is not null and ${wfhChangeRequests.coordinatorAcknowledgedAt} is null)`
        : sql<number>`count(*) filter (where ${wfhChangeRequests.kind} = 'substitution' and ${wfhChangeRequests.adminNotifiedAt} is not null and ${wfhChangeRequests.adminAcknowledgedAt} is null)`,
      revision: sql<string | null>`max(greatest(${wfhChangeRequests.createdAt}, coalesce(${wfhChangeRequests.decidedAt}, ${wfhChangeRequests.createdAt}), coalesce(${wfhChangeRequests.coordinatorNotifiedAt}, ${wfhChangeRequests.createdAt}), coalesce(${wfhChangeRequests.coordinatorAcknowledgedAt}, ${wfhChangeRequests.createdAt}), coalesce((select max(d.cancelled_at) from wfh_change_request_dates d where d.request_id = ${wfhChangeRequests.id}), ${wfhChangeRequests.createdAt})))`,
    })
    .from(wfhChangeRequests)
    .where(role === "admin" ? sql`${wfhChangeRequests.kind} = 'additional' OR (${wfhChangeRequests.kind} = 'substitution' AND ${wfhChangeRequests.adminNotifiedAt} IS NOT NULL)` : and(eq(wfhChangeRequests.coordinatorId, userId), ne(wfhChangeRequests.requesterId, userId)));

  return {
    actionableRequestCount: Number(result?.actionableRequestCount ?? 0),
    informationalRequestCount: Number(result?.informationalRequestCount ?? 0),
    revision: result?.revision ? String(result.revision) : null,
  };
}

export async function markSubstitutionAsRead(coordinatorId: string, requestId: string) {
  const updated = await getDb()
    .update(wfhChangeRequests)
    .set({ coordinatorAcknowledgedAt: new Date() })
    .where(and(
      eq(wfhChangeRequests.id, requestId),
      eq(wfhChangeRequests.coordinatorId, coordinatorId),
      eq(wfhChangeRequests.kind, "substitution"),
      sql`${wfhChangeRequests.coordinatorNotifiedAt} IS NOT NULL`,
      sql`${wfhChangeRequests.coordinatorAcknowledgedAt} IS NULL`,
    ))
    .returning({ id: wfhChangeRequests.id });

  return updated.length > 0;
}

export async function markAdminSubstitutionAsRead(requestId: string) {
  const updated = await getDb()
    .update(wfhChangeRequests)
    .set({ adminAcknowledgedAt: new Date() })
    .where(and(
      eq(wfhChangeRequests.id, requestId),
      eq(wfhChangeRequests.kind, "substitution"),
      sql`${wfhChangeRequests.adminNotifiedAt} IS NOT NULL`,
      sql`${wfhChangeRequests.adminAcknowledgedAt} IS NULL`,
      sql`${wfhChangeRequests.adminNotifiedAt} IS NOT NULL`,
    ))
    .returning({ id: wfhChangeRequests.id });

  return updated.length > 0;
}

export async function getRequestsForCoordinator(coordinatorId: string, filters: RequestFilters, cursorValue?: string): Promise<RequestPage<Awaited<ReturnType<typeof getCoordinatorRequests>>[number] & { requesterName: string; requesterEmail: string }>> {
  const cursor = decodeCursor(cursorValue);
  const requests = await getCoordinatorRequests(coordinatorId, filters, cursor);
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
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: adminRequestPageWhere(filters, cursor),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit: REQUEST_PAGE_SIZE + 1,
    columns: {
      id: true,
      requesterId: true,
      coordinatorId: true,
      kind: true,
      status: true,
      requesterComment: true,
      decisionComment: true,
      createdAt: true,
      decidedAt: true,
    },
    with: {
      dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) },
      requester: {
        columns: { id: true, oracleEmpId: true, fallbackName: true, fallbackEmail: true },
      },
    },
  });
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
  const conditions = [
    eq(wfhChangeRequests.kind, "substitution"),
    sql`${wfhChangeRequests.adminNotifiedAt} IS NOT NULL`,
    sql`${wfhChangeRequests.adminNotifiedAt} IS NOT NULL`,
  ];
  if (cursor) {
    conditions.push(sql`(${wfhChangeRequests.createdAt} < ${cursor.createdAt} OR (${wfhChangeRequests.createdAt} = ${cursor.createdAt} AND ${wfhChangeRequests.id} < ${cursor.id}))`);
  }
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: and(...conditions),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit: REQUEST_PAGE_SIZE + 1,
    columns: { id: true, requesterId: true, kind: true, status: true, requesterComment: true, decisionComment: true, createdAt: true, adminNotifiedAt: true, adminAcknowledgedAt: true },
    with: { dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) }, requester: { columns: { id: true, oracleEmpId: true, fallbackName: true, fallbackEmail: true } } },
  });
  const page = toRequestPage(requests);
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));
  return { ...page, requests: page.requests.map((request) => ({ ...request, requesterName: identities.get(request.requesterId)?.name ?? "Usuario", requesterEmail: identities.get(request.requesterId)?.email ?? "" })) };
}

function adminRequestPageWhere(filters: RequestFilters, cursor?: RequestCursor) {
  const baseWhere = adminRequestWhere(filters);
  if (!cursor) return baseWhere;

  return and(
    baseWhere,
    sql`(${wfhChangeRequests.createdAt} < ${cursor.createdAt} OR (${wfhChangeRequests.createdAt} = ${cursor.createdAt} AND ${wfhChangeRequests.id} < ${cursor.id}))`,
  );
}

async function getCoordinatorRequests(coordinatorId: string, filters: RequestFilters, cursor?: RequestCursor) {
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: and(requestPageWhere(filters, wfhChangeRequests.coordinatorId, coordinatorId, cursor), ne(wfhChangeRequests.requesterId, coordinatorId)),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit: REQUEST_PAGE_SIZE + 1,
    with: {
      dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) },
      requester: {
        columns: { id: true, oracleEmpId: true, fallbackName: true, fallbackEmail: true },
      },
    },
  });

  return requests;
}

async function getRequestWithDates(id: string) {
  return getDb().query.wfhChangeRequests.findFirst({
    where: eq(wfhChangeRequests.id, id),
    with: { dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) } },
  });
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

  const existing = await getDb().query.workFromHomeDays.findMany({
    where: and(eq(workFromHomeDays.userId, requester.id), inArray(workFromHomeDays.date, [...requestedDates, ...replacedDates])),
  });
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

    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(wfhChangeRequests)
        .set({ status, decisionComment: comment, decidedById: actor.id, decidedAt: new Date() })
        .where(and(eq(wfhChangeRequests.id, id), eq(wfhChangeRequests.status, "pending"), eq(wfhChangeRequests.kind, request.kind)))
        .returning({ id: wfhChangeRequests.id });

      if (updated.length === 0) {
        throw new Error("La solicitud ya ha sido procesada.");
      }

      if (status === "accepted") {
        const activeDates = request.dates.filter((date) => !date.cancelledAt);
        if (activeDates.length === 0) {
          throw new Error("La solicitud no tiene fechas activas para aprobar.");
        }

        if (request.kind === "substitution") {
          await tx.delete(workFromHomeDays).where(and(eq(workFromHomeDays.userId, requester.id), inArray(workFromHomeDays.date, activeDates.map((date) => date.replacedDate!))));
        }

        await tx.insert(workFromHomeDays).values(activeDates.map((date) => ({ userId: requester.id, date: date.requestedDate }))).onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
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
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM wfh_change_requests WHERE id = ${requestId} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM users WHERE id = ${actor.id} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM wfh_change_request_dates WHERE id = ${dateId} AND request_id = ${requestId} FOR UPDATE`);

      const currentRequest = await tx.query.wfhChangeRequests.findFirst({
        where: eq(wfhChangeRequests.id, requestId),
        with: { dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) } },
      });
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

      await tx.update(wfhChangeRequestDates)
        .set({ cancelledAt: new Date(), cancelledById: actor.id })
        .where(and(eq(wfhChangeRequestDates.id, dateId), sql`${wfhChangeRequestDates.cancelledAt} IS NULL`));

      const remaining = currentRequest.dates.filter((item) => item.id !== dateId && !item.cancelledAt);
      if (remaining.length === 0) {
        await tx.update(wfhChangeRequests)
          .set({ status: "cancelled", decisionComment: "Cancelada por el empleado.", decidedAt: new Date() })
          .where(eq(wfhChangeRequests.id, requestId));
      }
    });

    return { message: "Fecha cancelada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cancelar la fecha." };
  }
}
