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
      oracleEmpId: users.oracleEmpId,
      fallbackName: users.fallbackName,
      fallbackEmail: users.fallbackEmail,
    })
    .from(workFromHomeDays)
    .innerJoin(users, eq(workFromHomeDays.userId, users.id))
    .where(between(workFromHomeDays.date, start, end))
    .orderBy(asc(workFromHomeDays.date));
}

export function findWorkFromHomeDaysByUserIds(userIds: string[], start: string, end: string) {
  if (userIds.length === 0) {
    return Promise.resolve([]);
  }

  return getDb()
    .select({
      date: workFromHomeDays.date,
      userId: users.id,
      oracleEmpId: users.oracleEmpId,
      fallbackName: users.fallbackName,
      fallbackEmail: users.fallbackEmail,
    })
    .from(workFromHomeDays)
    .innerJoin(users, eq(workFromHomeDays.userId, users.id))
    .where(and(inArray(workFromHomeDays.userId, userIds), between(workFromHomeDays.date, start, end)))
    .orderBy(asc(workFromHomeDays.date));
}

export function createWorkFromHomeDay(userId: string, date: string) {
  return getDb()
    .insert(workFromHomeDays)
    .values({ userId, date })
    .onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
}

export function createWorkFromHomeDays(values: Array<{ userId: string; date: string }>) {
  if (values.length === 0) {
    return Promise.resolve();
  }

  return getDb().insert(workFromHomeDays).values(values).onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
}

export async function replaceWorkFromHomeDays(
  userId: string,
  start: string,
  end: string,
  values: Array<{ userId: string; date: string }>,
) {
  await getDb().transaction(async (tx) => {
    await tx.delete(workFromHomeDays).where(and(eq(workFromHomeDays.userId, userId), between(workFromHomeDays.date, start, end)));

    if (values.length > 0) {
      await tx.insert(workFromHomeDays).values(values).onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
    }
  });
}

export function deleteWorkFromHomeDay(userId: string, date: string) {
  return getDb()
    .delete(workFromHomeDays)
    .where(and(eq(workFromHomeDays.userId, userId), eq(workFromHomeDays.date, date)));
}
