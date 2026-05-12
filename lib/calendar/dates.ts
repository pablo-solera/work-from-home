export type CalendarDay = {
  date: string;
  dayNumber: number;
  isWeekend: boolean;
};

export type CalendarCell = CalendarDay | null;

export type CalendarMonthParams = {
  year: number;
  month: number;
};

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getCurrentCalendarMonth(): CalendarMonthParams {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function parseCalendarMonth(year?: string, month?: string): CalendarMonthParams {
  const current = getCurrentCalendarMonth();
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return current;
  }

  return {
    year: parsedYear,
    month: parsedMonth,
  };
}

export function getMonthRange(year: number, month: number) {
  const monthIndex = month - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));

  return {
    start: toDateKey(start),
    end: toDateKey(end),
    year,
    month,
  };
}

export function getPreviousMonth(year: number, month: number): CalendarMonthParams {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

export function getNextMonth(year: number, month: number): CalendarMonthParams {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }

  return { year, month: month + 1 };
}

export function createMonthHref(pathname: string, { year, month }: CalendarMonthParams) {
  return `${pathname}?year=${year}&month=${month}`;
}

export function isWeekendDateKey(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();

  return day === 0 || day === 6;
}

export function getCalendarDays(year: number, month: number) {
  const monthIndex = month - 1;
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const firstWeekday = firstDay.getUTCDay() === 0 ? 6 : firstDay.getUTCDay() - 1;
  const cells: CalendarCell[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= lastDay.getUTCDate(); day += 1) {
    const date = toDateKey(new Date(Date.UTC(year, monthIndex, day)));

    cells.push({
      date,
      dayNumber: day,
      isWeekend: isWeekendDateKey(date),
    });
  }

  return { cells, monthName: firstDay.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) };
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}
