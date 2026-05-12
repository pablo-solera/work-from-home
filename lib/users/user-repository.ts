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

export async function createUsers(values: NewUser[]) {
  if (values.length === 0) {
    return [];
  }

  return getDb().insert(users).values(values).onConflictDoNothing({ target: users.email }).returning();
}
