import type { SessionUser } from "@/lib/auth/session";
import { findUserById } from "@/lib/users/user-repository";
import { createWorkFromHomeDay, deleteWorkFromHomeDay, findUserWorkFromHomeDays, replaceWorkFromHomeDays } from "./calendar-repository";
import { assertCanEditWorkFromHomeDays, getMinimumEditableDate } from "./calendar-authorization";
import { getCalendarDays, getMadridTodayDateKey, getMonthRange, getMonthsUntilYearEnd, getWeekdayFromDateKey, isHoliday, isValidDateKey, isWeekendDateKey } from "./dates";

export type ReplicateWorkFromHomeScope = "next" | "untilYearEnd";

export async function setWorkFromHomeDay(userId: string, date: string, enabled: boolean, enforceAllowance = true) {
  if (!isValidDateKey(date)) throw new Error("Invalid date");
  if (isWeekendDateKey(date)) throw new Error("Weekend dates cannot be selected");
  if (isHoliday(date)) throw new Error("Holidays cannot be selected");
  if (enabled) {
    await createWorkFromHomeDay(userId, date, enforceAllowance);
    return;
  }
  await deleteWorkFromHomeDay(userId, date);
}

export async function setWorkFromHomeDayForActor(actor: SessionUser, targetUserId: string, date: string, enabled: boolean) {
  const minimumEditableDate = getMinimumEditableDate(actor.role);
  if (minimumEditableDate && date < minimumEditableDate) throw new Error("No puedes modificar días de teletrabajo anteriores a hoy.");
  await assertCanEditWorkFromHomeDays(actor, targetUserId);
  await setWorkFromHomeDay(targetUserId, date, enabled, actor.role !== "admin");
}

export async function replicateWorkFromHomeDays(actor: SessionUser, input: { month: number; scope: ReplicateWorkFromHomeScope; targetUserId: string; year: number }) {
  if (!Number.isInteger(input.year) || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) throw new Error("Invalid month");
  await assertCanEditWorkFromHomeDays(actor, input.targetUserId);

  const sourceRange = getMonthRange(input.year, input.month);
  const preserveOwnHistory = actor.role === "coordinator" && input.targetUserId === actor.id;
  const effectiveStart = preserveOwnHistory ? (sourceRange.start > getMadridTodayDateKey() ? sourceRange.start : getMadridTodayDateKey()) : sourceRange.start;
  const sourceEntries = await findUserWorkFromHomeDays(input.targetUserId, sourceRange.start, sourceRange.end);
  const sourceWeekdays = new Set(sourceEntries.map((entry) => getWeekdayFromDateKey(entry.date)));

  if (actor.role !== "admin") {
    const targetUser = await findUserById(input.targetUserId);
    if (sourceWeekdays.size > (targetUser?.wfhDaysAllowance ?? 0)) throw new Error("La replicación supera el cupo semanal de teletrabajo.");
  }
  if (sourceWeekdays.size === 0 || (input.scope === "next" && input.month === 12)) return;

  const targetMonths = [
    { year: input.year, month: input.month },
    ...(input.scope === "next" ? [{ year: input.year, month: input.month + 1 }] : getMonthsUntilYearEnd(input.year, input.month)),
  ];
  const values = targetMonths.flatMap(({ year, month }) => getCalendarDays(year, month).cells.flatMap((cell) => {
    if (!cell || cell.date < effectiveStart || cell.isWeekend || cell.isHoliday || !sourceWeekdays.has(getWeekdayFromDateKey(cell.date))) return [];
    return [{ userId: input.targetUserId, date: cell.date }];
  }));
  const lastMonth = targetMonths[targetMonths.length - 1];
  const targetRange = getMonthRange(lastMonth.year, lastMonth.month);
  if (effectiveStart <= targetRange.end) await replaceWorkFromHomeDays(input.targetUserId, effectiveStart, targetRange.end, values);
}
