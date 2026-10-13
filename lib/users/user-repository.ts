import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { type NewUser, users, workFromHomeDays } from "@/db/schema";

/** System accounts (no Oracle employee) log in with fallback_email. */
export function findUserByFallbackEmail(email: string) {
  return getDb().query.users.findFirst({
    where: and(eq(users.fallbackEmail, email), isNull(users.deactivatedAt)),
  });
}

export function findUserByOracleEmpId(oracleEmpId: number) {
  return getDb().query.users.findFirst({
    where: and(eq(users.oracleEmpId, oracleEmpId), isNull(users.deactivatedAt)),
  });
}

export function findUsersByOracleEmpIds(oracleEmpIds: number[]) {
  if (oracleEmpIds.length === 0) {
    return Promise.resolve([]);
  }

  return getDb().query.users.findMany({
    where: and(inArray(users.oracleEmpId, oracleEmpIds), isNull(users.deactivatedAt)),
  });
}

export const findUserById = cache((id: string) => {
  return getDb().query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deactivatedAt)),
  });
});

export const findAllUsers = cache(() => {
  return getDb().query.users.findMany({
    columns: {
      id: true,
      oracleEmpId: true,
      fallbackName: true,
      fallbackEmail: true,
    },
    where: isNull(users.deactivatedAt),
  });
});

export function findUsersForAdmin() {
  return getDb().query.users.findMany({
    columns: {
      canEditAllWfh: true,
      createdAt: true,
      hasWfh: true,
      id: true,
      oracleEmpId: true,
      fallbackName: true,
      fallbackEmail: true,
      wfhDaysAllowance: true,
    },
    where: isNull(users.deactivatedAt),
  });
}

/** All users that map to an Oracle employee, for sync/reconciliation. */
export function findUsersWithOracleEmpId() {
  return getDb().query.users.findMany({
    columns: {
      id: true,
      oracleEmpId: true,
      deactivatedAt: true,
    },
    where: isNotNull(users.oracleEmpId),
  });
}

export function countWorkFromHomeDaysByUserIds(userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([]);

  return getDb()
    .select({ userId: workFromHomeDays.userId, count: sql<number>`count(*)` })
    .from(workFromHomeDays)
    .where(inArray(workFromHomeDays.userId, userIds))
    .groupBy(workFromHomeDays.userId);
}

export async function createUsers(values: NewUser[]) {
  if (values.length === 0) {
    return [];
  }

  // oracle_emp_id uniqueness is a PARTIAL unique index (WHERE oracle_emp_id IS
  // NOT NULL), so ON CONFLICT must repeat the same predicate via `where` to
  // match it. All rows created here have a non-null oracleEmpId.
  return getDb().insert(users).values(values).onConflictDoNothing({ target: users.oracleEmpId, where: isNotNull(users.oracleEmpId) }).returning();
}

export function updateUser(id: string, values: Partial<Pick<NewUser, "canEditAllWfh" | "hasWfh" | "wfhDaysAllowance">>) {
  return getDb().update(users).set(values).where(eq(users.id, id)).returning();
}

export function updateTeamWfhVisibility(coordinatorId: string, teamWfhVisible: boolean) {
  return getDb().update(users).set({ teamWfhVisible }).where(eq(users.id, coordinatorId)).returning();
}

export function applyUserSync(createValues: NewUser[], reactivateIds: string[], deactivateIds: string[]) {
  return getDb().transaction(async (tx) => {
    const created = createValues.length > 0
      ? await tx.insert(users).values(createValues).onConflictDoNothing({ target: users.oracleEmpId, where: isNotNull(users.oracleEmpId) }).returning({ id: users.id })
      : [];
    const reactivated = reactivateIds.length > 0
      ? await tx.update(users).set({ deactivatedAt: null }).where(and(inArray(users.id, reactivateIds), isNotNull(users.deactivatedAt))).returning({ id: users.id })
      : [];
    const deactivated = deactivateIds.length > 0
      ? await tx.update(users).set({ deactivatedAt: new Date() }).where(and(inArray(users.id, deactivateIds), isNull(users.deactivatedAt))).returning({ id: users.id })
      : [];
    return { created, reactivated, deactivated };
  });
}
