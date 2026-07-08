import { eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { type NewUser, users } from "@/db/schema";

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

export function findEmployeesByCoordinatorId(coordinatorId: string) {
  return getDb().query.users.findMany({
    where: eq(users.coordinatorId, coordinatorId),
  });
}

export async function findEmployeeTeamVisibility(employeeId: string) {
  const employee = await getDb().query.users.findFirst({
    columns: {
      coordinatorId: true,
      id: true,
      role: true,
    },
    where: eq(users.id, employeeId),
    with: {
      coordinator: {
        columns: {
          id: true,
          teamWfhVisible: true,
        },
      },
    },
  });

  if (!employee || employee.role !== "employee" || !employee.coordinator) {
    return null;
  }

  return {
    coordinatorId: employee.coordinator.id,
    teamWfhVisible: employee.coordinator.teamWfhVisible,
  };
}

export function findCoordinators() {
  return getDb().query.users.findMany({
    columns: {
      id: true,
      oracleEmpId: true,
      fallbackName: true,
      fallbackEmail: true,
    },
    where: eq(users.role, "coordinator"),
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
      coordinatorId: true,
      createdAt: true,
      hasWfh: true,
      id: true,
      oracleEmpId: true,
      fallbackName: true,
      fallbackEmail: true,
      role: true,
      wfhDaysAllowance: true,
      wdNumber: true,
    },
    with: {
      coordinator: {
        columns: {
          id: true,
          oracleEmpId: true,
          fallbackName: true,
          fallbackEmail: true,
        },
      },
    },
  });
}

export function findEmployeeByCoordinatorId(employeeId: string, coordinatorId: string) {
  return getDb().query.users.findFirst({
    where: (users, { and, eq }) => and(eq(users.id, employeeId), eq(users.coordinatorId, coordinatorId)),
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

export async function createUsers(values: NewUser[]) {
  if (values.length === 0) {
    return [];
  }

  return getDb().insert(users).values(values).onConflictDoNothing({ target: users.oracleEmpId }).returning();
}

export function createUser(value: NewUser) {
  return getDb().insert(users).values(value).returning();
}

export function updateUser(id: string, values: Partial<Pick<NewUser, "canEditAllWfh" | "coordinatorId" | "hasWfh" | "role" | "wfhDaysAllowance" | "wdNumber">>) {
  return getDb().update(users).set(values).where(eq(users.id, id)).returning();
}

export function updateTeamWfhVisibility(coordinatorId: string, teamWfhVisible: boolean) {
  return getDb().update(users).set({ teamWfhVisible }).where(eq(users.id, coordinatorId)).returning();
}

export function updateUserTeleworkFields(id: string, values: Pick<NewUser, "hasWfh" | "wdNumber">) {
  return getDb().update(users).set(values).where(eq(users.id, id)).returning();
}

export function updateUserPassword(id: string, passwordHash: string) {
  return getDb().update(users).set({ passwordHash }).where(eq(users.id, id)).returning();
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
