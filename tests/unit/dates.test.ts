import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDateKeyForDisplay,
  getCalendarDays,
  getCurrentCalendarMonth,
  getMadridHolidayName,
  getMadridTodayDateKey,
  getMonthRange,
  getMonthsUntilYearEnd,
  getNextMonth,
  getPreviousMonth,
  getRequestDateRange,
  getSpanishNationalHolidayName,
  getWeekRange,
  getWeekdayFromDateKey,
  isDateInWeek,
  isHoliday,
  isSpanishNationalHoliday,
  isSubstitutionLocked,
  isValidDateKey,
  isWeekendDateKey,
  parseCalendarMonth,
} from "@/lib/calendar/dates";

describe("calendar dates", () => {
  afterEach(() => vi.useRealTimers());
  it("calculates month ranges and navigation across year boundaries", () => {
    expect(getMonthRange(2026, 2)).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
    expect(getPreviousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(getPreviousMonth(2026, 3)).toEqual({ year: 2026, month: 2 });
    expect(getNextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
    expect(getNextMonth(2026, 3)).toEqual({ year: 2026, month: 4 });
    expect(getMonthsUntilYearEnd(2026, 10)).toEqual([{ year: 2026, month: 11 }, { year: 2026, month: 12 }]);
    expect(getMonthsUntilYearEnd(2026, 12)).toEqual([]);
  });

  it("parses valid calendar months and falls back for invalid values", () => {
    expect(parseCalendarMonth("2026", "8")).toEqual({ year: 2026, month: 8 });
    vi.useFakeTimers({ now: new Date("2026-08-12T12:00:00.000Z") });
    expect(parseCalendarMonth("bad", "13")).toEqual({ year: 2026, month: 8 });
  });

  it("calculates Monday-to-Sunday weeks and membership", () => {
    expect(getWeekRange("2026-08-03")).toEqual({ start: "2026-08-03", end: "2026-08-09" });
    expect(getWeekRange("2026-08-04")).toEqual({ start: "2026-08-03", end: "2026-08-09" });
    expect(getWeekRange("2026-08-09")).toEqual({ start: "2026-08-03", end: "2026-08-09" });
    expect(isDateInWeek("2026-08-07", "2026-08-04")).toBe(true);
    expect(isDateInWeek("2026-08-10", "2026-08-04")).toBe(false);
    expect(getWeekdayFromDateKey("2026-08-09")).toBe(0);
    vi.useFakeTimers({ now: new Date("2026-08-12T12:00:00.000Z") });
    expect(getRequestDateRange("week")).toEqual({ start: "2026-08-10", end: "2026-08-16" });
    expect(getRequestDateRange("month")).toMatchObject({ start: "2026-08-01", end: "2026-08-31", year: 2026, month: 8 });
  });

  it("identifies holidays, weekends and valid date keys", () => {
    expect(isWeekendDateKey("2026-08-08")).toBe(true);
    expect(isWeekendDateKey("2026-08-07")).toBe(false);
    expect(getSpanishNationalHolidayName("2026-01-01")).toBe("Año Nuevo");
    expect(getSpanishNationalHolidayName("2026-04-03")).toBe("Viernes Santo");
    expect(getMadridHolidayName("2026-05-15")).toBe("San Isidro");
    expect(isSpanishNationalHoliday("2026-01-06")).toBe(true);
    expect(isHoliday("2026-05-15")).toBe(true);
    expect(isHoliday("2026-08-04")).toBe(false);
    expect(isHoliday("2026-12-24")).toBe(true);
    expect(isValidDateKey("2026-08-04")).toBe(true);
    expect(isValidDateKey("2026-8-4")).toBe(false);
    expect(formatDateKeyForDisplay("2026-08-04")).toBe("04-08-2026");
    expect(formatDateKeyForDisplay("invalid")).toBe("Fecha no válida");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(getMadridTodayDateKey())).toBe(true);
  });

  it("uses Madrid time for the current calendar month", () => {
    expect(getCurrentCalendarMonth(new Date("2026-08-31T22:30:00.000Z"))).toEqual({ year: 2026, month: 9 });
  });

  it("locks substitutions for today from 10:15 in Madrid", () => {
    const beforeCutoff = new Date("2026-08-05T08:14:59.000Z");
    const atCutoff = new Date("2026-08-05T08:15:00.000Z");
    const today = getMadridTodayDateKey(atCutoff);

    expect(isSubstitutionLocked(today, beforeCutoff)).toBe(false);
    expect(isSubstitutionLocked(today, atCutoff)).toBe(true);
    expect(isSubstitutionLocked("2026-08-06", atCutoff)).toBe(false);
  });

  it("builds calendar cells and calendar links", () => {
    const calendar = getCalendarDays(2026, 8);
    expect(calendar.cells.some((cell) => cell?.date === "2026-08-04")).toBe(true);
    expect(calendar.monthName).toContain("agosto");
  });
});
