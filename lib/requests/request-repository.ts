import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb, getPostgresClient } from "@/db";
import { users, wfhChangeRequestDates, wfhChangeRequests, workFromHomeDays } from "@/db/schema";
import { getRequestDateRange } from "@/lib/calendar/dates";
import type { RequestCursor, RequestFilters } from "./request-types";

export const REQUEST_NOTIFICATION_CHANNEL = "wfh_request_changed";

type Database = ReturnType<typeof getDb>;
export type RequestTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type RequestExecutor = Database | RequestTransaction;

export function listenForRequestNotifications(onPayload: (payload: string) => void, onReconnect: () => void): Promise<void> {
  return getPostgresClient().listen(REQUEST_NOTIFICATION_CHANNEL, onPayload, onReconnect).then(() => undefined);
}

const dateOrder = asc(wfhChangeRequestDates.requestedDate);

export function runInRequestTransaction<T>(callback: (tx: RequestTransaction) => Promise<T>) {
  return getDb().transaction(callback);
}

export function findRequesterById(userId: string) {
  return getDb().query.users.findFirst({ where: eq(users.id, userId) });
}

export function findRequester(executor: RequestExecutor, userId: string) {
  return executor.query.users.findFirst({ where: eq(users.id, userId) });
}

export function findRequesterId(executor: RequestExecutor, userId: string) {
  return executor.query.users.findFirst({ columns: { id: true }, where: eq(users.id, userId) });
}

export function lockUser(executor: RequestTransaction, userId: string) {
  return executor.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
}

export function lockRequest(executor: RequestTransaction, requestId: string) {
  return executor.execute(sql`SELECT id FROM wfh_change_requests WHERE id = ${requestId} FOR UPDATE`);
}

export function lockRequestDate(executor: RequestTransaction, requestId: string, dateId: string) {
  return executor.execute(sql`SELECT id FROM wfh_change_request_dates WHERE id = ${dateId} AND request_id = ${requestId} FOR UPDATE`);
}

export function lockRequestAndDateForCancellation(executor: RequestTransaction, requestId: string, dateId: string) {
  return executor.execute(sql`
    SELECT
      r.id AS request_id,
      r.requester_id,
      r.kind,
      r.status,
      d.id AS date_id,
      d.requested_date,
      d.cancelled_at,
      (
        SELECT count(*)
        FROM wfh_change_request_dates remaining
        WHERE remaining.request_id = r.id
          AND remaining.id <> d.id
          AND remaining.cancelled_at IS NULL
      ) AS active_dates_remaining
    FROM wfh_change_requests r
    INNER JOIN wfh_change_request_dates d ON d.request_id = r.id
    WHERE r.id = ${requestId} AND d.id = ${dateId}
    FOR UPDATE OF r, d
  `);
}

function matchingRequestIds(filters: RequestFilters) {
  if (filters.date === "all") return null;

  const range = getRequestDateRange(filters.date);
  return getDb()
    .select({ requestId: wfhChangeRequestDates.requestId })
    .from(wfhChangeRequestDates)
    .where(and(
      gte(wfhChangeRequestDates.requestedDate, range.start),
      lte(wfhChangeRequestDates.requestedDate, range.end),
      sql`${wfhChangeRequestDates.cancelledAt} IS NULL`,
    ));
}

export function requestWhere(
  filters: RequestFilters,
  userColumn: typeof wfhChangeRequests.requesterId | typeof wfhChangeRequests.coordinatorId,
  userId: string,
) {
  const conditions = [eq(userColumn, userId)];
  if (filters.status !== "all") conditions.push(eq(wfhChangeRequests.status, filters.status));

  const requestIds = matchingRequestIds(filters);
  if (requestIds) conditions.push(inArray(wfhChangeRequests.id, requestIds));

  return and(...conditions);
}

export function adminRequestWhere(filters: RequestFilters) {
  const conditions = [eq(wfhChangeRequests.kind, "additional")];
  if (filters.status !== "all") conditions.push(eq(wfhChangeRequests.status, filters.status));

  const requestIds = matchingRequestIds(filters);
  if (requestIds) conditions.push(inArray(wfhChangeRequests.id, requestIds));

  return and(...conditions);
}

function cursorWhere(cursor?: RequestCursor) {
  if (!cursor) return undefined;

  return sql`(${wfhChangeRequests.createdAt} < ${cursor.createdAt} OR (${wfhChangeRequests.createdAt} = ${cursor.createdAt} AND ${wfhChangeRequests.id} < ${cursor.id}))`;
}

export function findRequesterRequestsPage(userId: string, filters: RequestFilters, cursor: RequestCursor | undefined, limit: number) {
  const cursorCondition = cursorWhere(cursor);
  return getDb().query.wfhChangeRequests.findMany({
    where: and(requestWhere(filters, wfhChangeRequests.requesterId, userId), cursorCondition),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit,
    with: { dates: { orderBy: dateOrder } },
  });
}

export function findPendingRequestsWithDates(userId: string) {
  return getDb().query.wfhChangeRequests.findMany({
    columns: { id: true },
    where: and(eq(wfhChangeRequests.requesterId, userId), eq(wfhChangeRequests.status, "pending")),
    with: { dates: { columns: { requestedDate: true, replacedDate: true, cancelledAt: true } } },
  });
}

export function findPendingRequestedDatesInRange(userId: string, start: string, end: string) {
  return getDb().select({ requestedDate: wfhChangeRequestDates.requestedDate, replacedDate: wfhChangeRequestDates.replacedDate })
    .from(wfhChangeRequestDates)
    .innerJoin(wfhChangeRequests, eq(wfhChangeRequestDates.requestId, wfhChangeRequests.id))
    .where(and(
      eq(wfhChangeRequests.requesterId, userId),
      eq(wfhChangeRequests.status, "pending"),
      sql`${wfhChangeRequestDates.cancelledAt} IS NULL`,
      gte(wfhChangeRequestDates.requestedDate, start),
      lte(wfhChangeRequestDates.requestedDate, end),
    ));
}

type NotificationSummaryRow = { actionableRequestCount: string | number; informationalRequestCount: string | number; revision: string | null };

/**
 * Each counter reads only the rows it counts (partial indexes) and the revision is the newest updated_at
 * or date cancellation, so the cost no longer grows with the whole request history.
 */
export async function findNotificationSummary(userId: string, role: "admin" | "coordinator"): Promise<NotificationSummaryRow[]> {
  const revision = sql`to_char(greatest((select max(updated_at) from wfh_change_requests), (select max(cancelled_at) from wfh_change_request_dates)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')`;
  const result = role === "admin"
    ? await getDb().execute<NotificationSummaryRow>(sql`
        select
          (select count(*) from wfh_change_requests where kind = 'additional' and status = 'pending') as "actionableRequestCount",
          (select count(*) from wfh_change_requests where kind = 'substitution' and admin_notified_at is not null and admin_acknowledged_at is null) as "informationalRequestCount",
          ${revision} as "revision"`)
    : await getDb().execute<NotificationSummaryRow>(sql`
        select
          0 as "actionableRequestCount",
          (select count(*) from wfh_change_requests where coordinator_id = ${userId} and requester_id <> ${userId} and kind = 'additional' and status = 'pending')
            + (select count(*) from wfh_change_requests where coordinator_id = ${userId} and requester_id <> ${userId} and kind in ('substitution', 'removal') and coordinator_notified_at is not null and coordinator_acknowledged_at is null) as "informationalRequestCount",
          ${revision} as "revision"`);
  return [...result];
}

export function findCoordinatorRequestsPage(coordinatorId: string, filters: RequestFilters, cursor: RequestCursor | undefined, limit: number) {
  const cursorCondition = cursorWhere(cursor);
  return getDb().query.wfhChangeRequests.findMany({
    where: and(requestWhere(filters, wfhChangeRequests.coordinatorId, coordinatorId), ne(wfhChangeRequests.requesterId, coordinatorId), cursorCondition),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit,
    with: {
      dates: { orderBy: dateOrder },
      requester: { columns: { id: true, oracleEmpId: true, fallbackName: true, fallbackEmail: true } },
    },
  });
}

export function findAdminRequestsPage(filters: RequestFilters, cursor: RequestCursor | undefined, limit: number) {
  const cursorCondition = cursorWhere(cursor);
  return getDb().query.wfhChangeRequests.findMany({
    where: and(adminRequestWhere(filters), cursorCondition),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit,
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
      dates: { orderBy: dateOrder },
      requester: { columns: { id: true, oracleEmpId: true, fallbackName: true, fallbackEmail: true } },
    },
  });
}

export function findAdminSubstitutionNotificationsPage(cursor: RequestCursor | undefined, limit: number) {
  const conditions = [
    eq(wfhChangeRequests.kind, "substitution"),
    sql`${wfhChangeRequests.adminNotifiedAt} IS NOT NULL`,
  ];
  const cursorCondition = cursorWhere(cursor);

  return getDb().query.wfhChangeRequests.findMany({
    where: and(...conditions, cursorCondition),
    orderBy: [desc(wfhChangeRequests.createdAt), desc(wfhChangeRequests.id)],
    limit,
    columns: { id: true, requesterId: true, kind: true, status: true, requesterComment: true, decisionComment: true, createdAt: true, adminNotifiedAt: true, adminAcknowledgedAt: true },
    with: { dates: { orderBy: dateOrder }, requester: { columns: { id: true, oracleEmpId: true, fallbackName: true, fallbackEmail: true } } },
  });
}

export function findRequestWithDates(executor: RequestExecutor, requestId: string) {
  return executor.query.wfhChangeRequests.findFirst({
    where: eq(wfhChangeRequests.id, requestId),
    with: { dates: { orderBy: dateOrder } },
  });
}

export function findRequestByIdWithDates(requestId: string) {
  return findRequestWithDates(getDb(), requestId);
}

export function findPendingRequestDates(executor: RequestTransaction, userId: string) {
  return executor
    .select({ requestedDate: wfhChangeRequestDates.requestedDate, replacedDate: wfhChangeRequestDates.replacedDate })
    .from(wfhChangeRequestDates)
    .innerJoin(wfhChangeRequests, eq(wfhChangeRequestDates.requestId, wfhChangeRequests.id))
    .where(and(eq(wfhChangeRequests.requesterId, userId), eq(wfhChangeRequests.status, "pending"), sql`${wfhChangeRequestDates.cancelledAt} IS NULL`));
}

export function findWorkFromHomeDays(executor: RequestExecutor, userId: string, dates: string[]) {
  return executor.query.workFromHomeDays.findMany({
    where: and(eq(workFromHomeDays.userId, userId), inArray(workFromHomeDays.date, dates)),
  });
}

export function findWorkFromHomeDaysByUser(userId: string, dates: string[]) {
  return findWorkFromHomeDays(getDb(), userId, dates);
}

export function insertRequest(executor: RequestTransaction, values: typeof wfhChangeRequests.$inferInsert) {
  return executor.insert(wfhChangeRequests).values(values).returning({ id: wfhChangeRequests.id });
}

export function insertRequestDates(executor: RequestTransaction, values: (typeof wfhChangeRequestDates.$inferInsert)[]) {
  return executor.insert(wfhChangeRequestDates).values(values);
}

export function deleteWorkFromHomeDays(executor: RequestTransaction, userId: string, dates: string[]) {
  return executor.delete(workFromHomeDays).where(and(eq(workFromHomeDays.userId, userId), inArray(workFromHomeDays.date, dates))).returning({ id: workFromHomeDays.id });
}

export function insertWorkFromHomeDays(executor: RequestTransaction, values: (typeof workFromHomeDays.$inferInsert)[], ignoreConflicts: boolean) {
  const query = executor.insert(workFromHomeDays).values(values);
  return ignoreConflicts
    ? query.onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] })
    : query;
}

export function updateRequestDecision(executor: RequestTransaction, requestId: string, kind: "additional" | "substitution" | "removal", status: "accepted" | "rejected", decisionComment: string | null, decidedById: string) {
  return executor
    .update(wfhChangeRequests)
    .set({ status, decisionComment, decidedById, decidedAt: new Date() })
    .where(and(eq(wfhChangeRequests.id, requestId), eq(wfhChangeRequests.status, "pending"), eq(wfhChangeRequests.kind, kind)))
    .returning({ id: wfhChangeRequests.id });
}

export function cancelRequestDate(executor: RequestTransaction, dateId: string, actorId: string) {
  return executor
    .update(wfhChangeRequestDates)
    .set({ cancelledAt: new Date(), cancelledById: actorId })
    .where(and(eq(wfhChangeRequestDates.id, dateId), sql`${wfhChangeRequestDates.cancelledAt} IS NULL`));
}

export function cancelRequest(executor: RequestTransaction, requestId: string) {
  return executor
    .update(wfhChangeRequests)
    .set({ status: "cancelled", decisionComment: "Cancelada por el empleado.", decidedAt: new Date() })
    .where(eq(wfhChangeRequests.id, requestId));
}

export function acknowledgeCoordinatorSubstitution(coordinatorId: string, requestId: string) {
  return getDb()
    .update(wfhChangeRequests)
    .set({ coordinatorAcknowledgedAt: new Date() })
    .where(and(
      eq(wfhChangeRequests.id, requestId),
      eq(wfhChangeRequests.coordinatorId, coordinatorId),
      inArray(wfhChangeRequests.kind, ["substitution", "removal"] as const),
      sql`${wfhChangeRequests.coordinatorNotifiedAt} IS NOT NULL`,
      sql`${wfhChangeRequests.coordinatorAcknowledgedAt} IS NULL`,
    ))
    .returning({ id: wfhChangeRequests.id });
}

export function acknowledgeAdminSubstitution(requestId: string) {
  return getDb()
    .update(wfhChangeRequests)
    .set({ adminAcknowledgedAt: new Date() })
    .where(and(
      eq(wfhChangeRequests.id, requestId),
      eq(wfhChangeRequests.kind, "substitution"),
      sql`${wfhChangeRequests.adminNotifiedAt} IS NOT NULL`,
      sql`${wfhChangeRequests.adminAcknowledgedAt} IS NULL`,
    ))
    .returning({ id: wfhChangeRequests.id });
}
