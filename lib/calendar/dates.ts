import { getMadridTodayDateKey, getTodayDateKey, getWeekdayFromDateKey, isWeekendDateKey, toDateKey } from "./date-utils";
import { getHolidayName } from "./holidays";

export { formatDateKeyForDisplay, getMadridTodayDateKey, getTodayDateKey, getWeekRange, getWeekdayFromDateKey, isDateInWeek, isValidDateKey, isWeekendDateKey, toDateKey } from "./date-utils";
export { getCompanyHolidayName, getHolidayName, getMadridHolidayName, getSpanishNationalHolidayName, isHoliday, isSpanishNationalHoliday } from "./holidays";

export type CalendarDay = { date: string; dayNumber: number; holidayName: string | null; isHoliday: boolean; isToday: boolean; isWeekend: boolean };
export type CalendarCell = CalendarDay | null;
export type CalendarMonthParams = { year: number; month: number };
export type RequestDateFilter = "all" | "month" | "week";

export const SUBSTITUTION_CUTOFF_MINUTES = 10 * 60 + 15;

export function isSubstitutionLocked(dateKey: string, now = new Date()) {
  if (dateKey !== getMadridTodayDateKey(now)) return false;
  const parts = new Intl.DateTimeFormat("en", { hour: "2-digit", hourCycle: "h23", minute: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute) >= SUBSTITUTION_CUTOFF_MINUTES;
}

function addDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function getRequestDateRange(filter: Exclude<RequestDateFilter, "all">) {
  const today = getMadridTodayDateKey();
  if (filter === "month") return getMonthRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const weekday = getWeekdayFromDateKey(today);
  const start = addDateKey(today, weekday === 0 ? -6 : 1 - weekday);
  return { start, end: addDateKey(start, 6) };
}

export function getCurrentCalendarMonth(date = new Date()): CalendarMonthParams {
  const today = getMadridTodayDateKey(date);
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function parseCalendarMonth(year?: string, month?: string): CalendarMonthParams {
  const current = getCurrentCalendarMonth();
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  return Number.isInteger(parsedYear) && Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? { year: parsedYear, month: parsedMonth } : current;
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: toDateKey(start), end: toDateKey(end), year, month };
}

export function getPreviousMonth(year: number, month: number): CalendarMonthParams {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function getNextMonth(year: number, month: number): CalendarMonthParams {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function getMonthsUntilYearEnd(year: number, month: number): CalendarMonthParams[] {
  return month >= 12 ? [] : Array.from({ length: 12 - month }, (_, index) => ({ year, month: month + index + 1 }));
}

export function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const firstWeekday = firstDay.getUTCDay() === 0 ? 6 : firstDay.getUTCDay() - 1;
  const cells: CalendarCell[] = Array.from({ length: firstWeekday }, () => null);
  const today = getTodayDateKey();
  for (let day = 1; day <= lastDay.getUTCDate(); day += 1) {
    const date = toDateKey(new Date(Date.UTC(year, month - 1, day)));
    const holidayName = getHolidayName(date);
    cells.push({ date, dayNumber: day, holidayName, isHoliday: holidayName !== null, isToday: date === today, isWeekend: isWeekendDateKey(date) });
  }
  return { cells, monthName: firstDay.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) };
}
