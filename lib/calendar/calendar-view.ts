import { createCalendarHref } from "./links";
import { getCurrentCalendarMonth, getNextMonth, getPreviousMonth } from "./dates";

export function getCalendarNavigation(basePath: string, year: number, month: number, employeeId?: string) {
  const currentMonth = getCurrentCalendarMonth();
  const nextMonth = getNextMonth(year, month);
  const previousMonth = getPreviousMonth(year, month);

  return {
    currentMonthHref: createCalendarHref(basePath, { employeeId, month: currentMonth.month, year: currentMonth.year }),
    nextMonthHref: createCalendarHref(basePath, { employeeId, month: nextMonth.month, year: nextMonth.year }),
    previousMonthHref: createCalendarHref(basePath, { employeeId, month: previousMonth.month, year: previousMonth.year }),
    showCurrentMonthLink: year !== currentMonth.year || month !== currentMonth.month,
  };
}
