import { and, asc, between, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, workFromHomeDays } from "@/db/schema";
import { hasReachedWeeklyAllowance, WEEKLY_ALLOWANCE_ERROR } from "./calendar-business-rules";

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

export function createWorkFromHomeDay(userId: string, date: string, enforceAllowance = true) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const existing = await tx.query.workFromHomeDays.findFirst({
      columns: { id: true },
      where: and(eq(workFromHomeDays.userId, userId), eq(workFromHomeDays.date, date)),
    });
    if (existing) {
      return;
    }

    const user = await tx.query.users.findFirst({
      columns: { wfhDaysAllowance: true },
      where: eq(users.id, userId),
    });
    const weekStart = sql`date_trunc('week', ${date}::date)::date`;
    const usage = await tx
      .select({ count: sql<number>`count(*)` })
      .from(workFromHomeDays)
      .where(and(eq(workFromHomeDays.userId, userId), sql`date_trunc('week', ${workFromHomeDays.date})::date = ${weekStart}`));

    if (enforceAllowance && hasReachedWeeklyAllowance(Number(usage[0]?.count ?? 0), user?.wfhDaysAllowance ?? 0)) {
      throw new Error(WEEKLY_ALLOWANCE_ERROR);
    }

    await tx.insert(workFromHomeDays).values({ userId, date }).onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
  });
}

export async function replaceWorkFromHomeDays(
  userId: string,
  start: string,
  end: string,
  values: Array<{ userId: string; date: string }>,
) {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    await tx.delete(workFromHomeDays).where(and(eq(workFromHomeDays.userId, userId), between(workFromHomeDays.date, start, end)));

    if (values.length > 0) {
      await tx.insert(workFromHomeDays).values(values).onConflictDoNothing({ target: [workFromHomeDays.userId, workFromHomeDays.date] });
    }
  });
}

export function deleteWorkFromHomeDay(userId: string, date: string) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    await tx.delete(workFromHomeDays).where(and(eq(workFromHomeDays.userId, userId), eq(workFromHomeDays.date, date)));
  });
}
