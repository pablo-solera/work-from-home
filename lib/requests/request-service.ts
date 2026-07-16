import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, wfhChangeRequestDates, wfhChangeRequests, workFromHomeDays } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { getAbsenceSectionsByDate } from "@/lib/absences/absence-service";
import { getHolidayName, isValidDateKey, isWeekendDateKey } from "@/lib/calendar/dates";
import { resolveUserIdentities } from "@/lib/employees/identity-service";

export type RequestFormState = { error?: string; message?: string; ok?: boolean };
export type RequestKind = "additional" | "substitution";

type RequestInput = {
  kind: RequestKind;
  requestedDates: string[];
  replacedDates: string[];
  comment: string | null;
};

function validateDates(dates: string[]) {
  if (dates.length === 0 || dates.some((date) => !isValidDateKey(date) || isWeekendDateKey(date) || getHolidayName(date))) {
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

    if (input.kind === "substitution") {
      if (input.replacedDates.length !== input.requestedDates.length) {
        throw new Error("Debes indicar una fecha a sustituir por cada fecha solicitada.");
      }

      validateDates(input.replacedDates);
      if (input.replacedDates.some((date, index) => date === input.requestedDates[index])) {
        throw new Error("La fecha nueva debe ser distinta de la fecha sustituida.");
      }
    }

    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`);
      const requester = await tx.query.users.findFirst({ where: eq(users.id, user.id) });

      if (!requester || requester.role !== "employee" || !requester.coordinatorId) {
        throw new Error("Solo los empleados con coordinador pueden crear solicitudes.");
      }

      const pendingDates = await tx
        .select({ requestedDate: wfhChangeRequestDates.requestedDate, replacedDate: wfhChangeRequestDates.replacedDate })
        .from(wfhChangeRequestDates)
        .innerJoin(wfhChangeRequests, eq(wfhChangeRequestDates.requestId, wfhChangeRequests.id))
        .where(and(eq(wfhChangeRequests.requesterId, user.id), eq(wfhChangeRequests.status, "pending")));
      const requestedDates = new Set(input.requestedDates);
      const affectedDates = new Set([...requestedDates, ...input.replacedDates]);
      const hasDuplicate = pendingDates.some((date) => affectedDates.has(date.requestedDate) || (date.replacedDate ? affectedDates.has(date.replacedDate) : false));

      if (hasDuplicate) {
        throw new Error("Ya existe una solicitud pendiente para una de las fechas seleccionadas.");
      }

      const [request] = await tx
        .insert(wfhChangeRequests)
        .values({
          requesterId: user.id,
          coordinatorId: requester.coordinatorId!,
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

    return { message: "Solicitud enviada correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la solicitud." };
  }
}

export async function getRequestsForRequester(userId: string) {
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: eq(wfhChangeRequests.requesterId, userId),
    orderBy: desc(wfhChangeRequests.createdAt),
    with: { dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) } },
  });

  return requests;
}

export async function getPendingRequestedDates(userId: string, start: string, end: string) {
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: and(eq(wfhChangeRequests.requesterId, userId), eq(wfhChangeRequests.status, "pending")),
    with: { dates: true },
  });

  return requests.flatMap((request) =>
    request.dates.flatMap((date) => {
      const dates = [date.requestedDate];
      if (date.replacedDate) dates.push(date.replacedDate);
      return dates.filter((value) => value >= start && value <= end);
    }),
  );
}

export async function getPendingRequestCountForCoordinator(coordinatorId: string) {
  const [result] = await getDb()
    .select({ count: count() })
    .from(wfhChangeRequests)
    .where(and(eq(wfhChangeRequests.coordinatorId, coordinatorId), eq(wfhChangeRequests.status, "pending")));

  return result?.count ?? 0;
}

export async function getRequestsForCoordinator(coordinatorId: string) {
  const requests = await getDb().query.wfhChangeRequests.findMany({
    where: eq(wfhChangeRequests.coordinatorId, coordinatorId),
    orderBy: desc(wfhChangeRequests.createdAt),
    with: {
      dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) },
      requester: true,
    },
  });
  const identities = await resolveUserIdentities(requests.map((request) => request.requester));

  return requests.map((request) => ({
    ...request,
    requesterName: identities.get(request.requester.id)?.name ?? request.requester.fallbackName ?? "Usuario",
    requesterEmail: identities.get(request.requester.id)?.email ?? request.requester.fallbackEmail ?? "",
  }));
}

async function getRequestWithDates(id: string) {
  return getDb().query.wfhChangeRequests.findFirst({
    where: eq(wfhChangeRequests.id, id),
    with: { dates: { orderBy: asc(wfhChangeRequestDates.requestedDate) } },
  });
}

async function validateApproval(request: NonNullable<Awaited<ReturnType<typeof getRequestWithDates>>>, actor: SessionUser) {
  if (request.status !== "pending" || request.coordinatorId !== actor.id) {
    throw new Error("La solicitud ya ha sido procesada o no pertenece a tu equipo.");
  }

  const requester = await getRequester(request.requesterId);
  if (!requester || requester.coordinatorId !== actor.id) {
    throw new Error("El empleado ya no pertenece a tu equipo.");
  }

  const requestedDates = request.dates.map((date) => date.requestedDate);
  const replacedDates = request.dates.flatMap((date) => (date.replacedDate ? [date.replacedDate] : []));
  const range = requestRange([...requestedDates, ...replacedDates]);
  const absenceSections = await getAbsenceSectionsByDate(range.start, range.end, [requester]);
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
    if (request.dates.some((date) => !date.replacedDate || !existingDates.has(date.replacedDate))) {
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

  if (!request || request.coordinatorId !== actor.id || request.status !== "pending") {
    return { error: "La solicitud ya ha sido procesada o no pertenece a tu equipo." };
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
        .where(and(eq(wfhChangeRequests.id, id), eq(wfhChangeRequests.status, "pending")))
        .returning({ id: wfhChangeRequests.id });

      if (updated.length === 0) {
        throw new Error("La solicitud ya ha sido procesada.");
      }

      if (status === "accepted") {
        if (request.kind === "substitution") {
          await tx.delete(workFromHomeDays).where(and(eq(workFromHomeDays.userId, requester.id), inArray(workFromHomeDays.date, request.dates.map((date) => date.replacedDate!))));
        }

        await tx.insert(workFromHomeDays).values(request.dates.map((date) => ({ userId: requester.id, date: date.requestedDate }))).onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
      }
    });

    return { message: status === "accepted" ? "Solicitud aceptada." : "Solicitud rechazada.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo resolver la solicitud." };
  }
}
