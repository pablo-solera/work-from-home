import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { type NewUser, users } from "@/db/schema";

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
