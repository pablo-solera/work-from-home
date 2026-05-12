import { createWorkFromHomeDay, deleteWorkFromHomeDay, findAllWorkFromHomeDays, findUserWorkFromHomeDays } from "./calendar-repository";
import { getCalendarDays, getMonthRange, isHoliday, isValidDateKey, isWeekendDateKey } from "./dates";

export async function getUserCalendar(userId: string, year: number, month: number) {
  const range = getMonthRange(year, month);
  const entries = await findUserWorkFromHomeDays(userId, range.start, range.end);
  const selectedDates = new Set(entries.map((entry) => entry.date));
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    selectedDates: Array.from(selectedDates),
  };
}

export async function getAdminCalendarOverview(year: number, month: number) {
  const range = getMonthRange(year, month);
  const entries = await findAllWorkFromHomeDays(range.start, range.end);
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    entriesByDate: entries.reduce<Record<string, typeof entries>>((accumulator, entry) => {
      accumulator[entry.date] = accumulator[entry.date] ?? [];
      accumulator[entry.date].push(entry);
      return accumulator;
    }, {}),
  };
}

export async function setWorkFromHomeDay(userId: string, date: string, enabled: boolean) {
  if (!isValidDateKey(date)) {
    throw new Error("Invalid date");
  }

  if (isWeekendDateKey(date)) {
    throw new Error("Weekend dates cannot be selected");
  }

  if (isHoliday(date)) {
    throw new Error("Holidays cannot be selected");
  }

  if (enabled) {
    await createWorkFromHomeDay(userId, date);
    return;
  }

  await deleteWorkFromHomeDay(userId, date);
}
