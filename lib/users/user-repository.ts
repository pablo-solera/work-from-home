import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { type NewUser, users } from "@/db/schema";

export type AdminUserRow = Awaited<ReturnType<typeof findUsersForAdmin>>[number];

export function findUserByEmail(email: string) {
  return getDb().query.users.findFirst({
    where: eq(users.email, email),
  });
}

export function findUsersByEmails(emails: string[]) {
  if (emails.length === 0) {
    return Promise.resolve([]);
  }

  return getDb().query.users.findMany({
    where: inArray(users.email, emails),
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
    orderBy: (users, { asc }) => [asc(users.name)],
  });
}

export function findCoordinators() {
  return getDb().query.users.findMany({
    columns: {
      email: true,
      id: true,
      name: true,
    },
    orderBy: (users, { asc }) => [asc(users.name)],
    where: eq(users.role, "coordinator"),
  });
}

export function findAllUsers() {
  return getDb().query.users.findMany({
    columns: {
      email: true,
      id: true,
      name: true,
    },
    orderBy: (users, { asc }) => [asc(users.name)],
  });
}

export function findUsersForAdmin() {
  return getDb().query.users.findMany({
    columns: {
      coordinatorId: true,
      createdAt: true,
      email: true,
      hasWfh: true,
      id: true,
      name: true,
      role: true,
      wdNumber: true,
    },
    orderBy: (users, { asc }) => [asc(users.name)],
    with: {
      coordinator: {
        columns: {
          email: true,
          id: true,
          name: true,
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

export async function createUsers(values: NewUser[]) {
  if (values.length === 0) {
    return [];
  }

  return getDb().insert(users).values(values).onConflictDoNothing({ target: users.email }).returning();
}

export function createUser(value: NewUser) {
  return getDb().insert(users).values(value).returning();
}

export function updateUser(id: string, values: Partial<Pick<NewUser, "coordinatorId" | "email" | "hasWfh" | "name" | "role" | "wdNumber">>) {
  return getDb().update(users).set(values).where(eq(users.id, id)).returning();
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
