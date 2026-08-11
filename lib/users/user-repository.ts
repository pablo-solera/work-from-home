import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { type NewUser, users, workFromHomeDays } from "@/db/schema";

export type AdminUserRow = Awaited<ReturnType<typeof findUsersForAdmin>>[number];

/** System accounts (no Oracle employee) log in with fallback_email. */
export function findUserByFallbackEmail(email: string) {
  return getDb().query.users.findFirst({
    where: eq(users.fallbackEmail, email),
  });
}

export function findUserByOracleEmpId(oracleEmpId: number) {
  return getDb().query.users.findFirst({
    where: eq(users.oracleEmpId, oracleEmpId),
  });
}

export function findUsersByOracleEmpIds(oracleEmpIds: number[]) {
  if (oracleEmpIds.length === 0) {
    return Promise.resolve([]);
  }

  return getDb().query.users.findMany({
    where: inArray(users.oracleEmpId, oracleEmpIds),
  });
}

export function findUserById(id: string) {
  return getDb().query.users.findFirst({
    where: eq(users.id, id),
  });
}

export function findAllUsers() {
  return getDb().query.users.findMany({
    columns: {
      id: true,
      oracleEmpId: true,
      fallbackName: true,
      fallbackEmail: true,
    },
  });
}

/** Alias kept for callers that need the Oracle id alongside basic user data. */
export function findAllUsersWithOracleId() {
  return findAllUsers();
}

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
  });
}

/** All users that map to an Oracle employee, for sync/reconciliation. */
export function findUsersWithOracleEmpId() {
  return getDb().query.users.findMany({
    columns: {
      id: true,
      oracleEmpId: true,
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

export function createUser(value: NewUser) {
  return getDb().insert(users).values(value).returning();
}

export function updateUser(id: string, values: Partial<Pick<NewUser, "canEditAllWfh" | "hasWfh" | "wfhDaysAllowance">>) {
  return getDb().update(users).set(values).where(eq(users.id, id)).returning();
}

export function updateTeamWfhVisibility(coordinatorId: string, teamWfhVisible: boolean) {
  return getDb().update(users).set({ teamWfhVisible }).where(eq(users.id, coordinatorId)).returning();
}

export function deleteUser(id: string) {
  return getDb().delete(users).where(eq(users.id, id)).returning();
}

export function deleteUsers(ids: string[]) {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }

  return getDb().delete(users).where(inArray(users.id, ids)).returning();
}
