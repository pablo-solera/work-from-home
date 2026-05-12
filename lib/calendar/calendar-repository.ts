import { and, asc, between, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { users, workFromHomeDays } from "@/db/schema";

export function findUserWorkFromHomeDays(userId: string, start: string, end: string) {
  return getDb().query.workFromHomeDays.findMany({
    where: and(
      eq(workFromHomeDays.userId, userId),
      between(workFromHomeDays.date, start, end)
    ),
    orderBy: asc(workFromHomeDays.date),
  });
}

export function findAllWorkFromHomeDays(start: string, end: string) {
  return getDb()
    .select({
      date: workFromHomeDays.date,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(workFromHomeDays)
    .innerJoin(users, eq(workFromHomeDays.userId, users.id))
    .where(between(workFromHomeDays.date, start, end))
    .orderBy(asc(workFromHomeDays.date), asc(users.name));
}

export function findWorkFromHomeDaysByUserIds(userIds: string[], start: string, end: string) {
  if (userIds.length === 0) {
    return Promise.resolve([]);
  }

  return getDb()
    .select({
      date: workFromHomeDays.date,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(workFromHomeDays)
    .innerJoin(users, eq(workFromHomeDays.userId, users.id))
    .where(and(inArray(workFromHomeDays.userId, userIds), between(workFromHomeDays.date, start, end)))
    .orderBy(asc(workFromHomeDays.date), asc(users.name));
}

export function createWorkFromHomeDay(userId: string, date: string) {
  return getDb()
    .insert(workFromHomeDays)
    .values({ userId, date })
    .onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
}

export function deleteWorkFromHomeDay(userId: string, date: string) {
  return getDb()
    .delete(workFromHomeDays)
    .where(and(eq(workFromHomeDays.userId, userId), eq(workFromHomeDays.date, date)));
}
