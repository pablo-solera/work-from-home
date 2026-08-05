export type CalendarDay = {
  date: string;
  dayNumber: number;
  holidayName: string | null;
  isHoliday: boolean;
  isToday: boolean;
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

export function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMadridTodayDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Madrid",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export const SUBSTITUTION_CUTOFF_MINUTES = 10 * 60 + 15;

export function isSubstitutionLocked(dateKey: string, now = new Date()) {
  if (dateKey !== getMadridTodayDateKey(now)) return false;

  const parts = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minutes = Number(values.hour) * 60 + Number(values.minute);

  return minutes >= SUBSTITUTION_CUTOFF_MINUTES;
}

function addDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export type RequestDateFilter = "all" | "month" | "week";

export function getRequestDateRange(filter: Exclude<RequestDateFilter, "all">) {
  const today = getMadridTodayDateKey();

  if (filter === "month") {
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    return getMonthRange(year, month);
  }

  const weekday = getWeekdayFromDateKey(today);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDateKey(today, mondayOffset);

  return { start, end: addDateKey(start, 6) };
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

export function getMonthsUntilYearEnd(year: number, month: number): CalendarMonthParams[] {
  if (month >= 12) {
    return [];
  }

  return Array.from({ length: 12 - month }, (_, index) => ({ year, month: month + index + 1 }));
}

export function createMonthHref(pathname: string, { year, month }: CalendarMonthParams) {
  return `${pathname}?year=${year}&month=${month}`;
}

export function isWeekendDateKey(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();

  return day === 0 || day === 6;
}

export function getWeekdayFromDateKey(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export function getWeekRange(date: string) {
  const weekday = getWeekdayFromDateKey(date);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;

  return {
    start: addDateKey(date, mondayOffset),
    end: addDateKey(date, mondayOffset + 6),
  };
}

export function isDateInWeek(date: string, referenceDate: string) {
  const range = getWeekRange(referenceDate);
  return date >= range.start && date <= range.end;
}

function getEasterSundayDateKey(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

  return toDateKey(new Date(Date.UTC(year, easterMonth - 1, easterDay)));
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return toDateKey(date);
}

export function getSpanishNationalHolidayName(date: string) {
  const year = Number(date.slice(0, 4));
  const fixedHolidays: Record<string, string> = {
    [`${year}-01-01`]: "Año Nuevo",
    [`${year}-01-06`]: "Epifanía del Señor",
    [`${year}-05-01`]: "Día del Trabajo",
    [`${year}-08-15`]: "Asunción de la Virgen",
    [`${year}-10-12`]: "Fiesta Nacional de España",
    [`${year}-11-01`]: "Todos los Santos",
    [`${year}-12-06`]: "Día de la Constitución",
    [`${year}-12-08`]: "Inmaculada Concepción",
    [`${year}-12-25`]: "Navidad",
  };
  const goodFriday = addDays(getEasterSundayDateKey(year), -2);

  return fixedHolidays[date] ?? (date === goodFriday ? "Viernes Santo" : null);
}

export function isSpanishNationalHoliday(date: string) {
  return getSpanishNationalHolidayName(date) !== null;
}

export function getMadridHolidayName(date: string) {
  const year = Number(date.slice(0, 4));
  const holidays: Record<string, string> = {
    [`${year}-05-02`]: "Día de la Comunidad de Madrid",
    [`${year}-05-15`]: "San Isidro",
    [`${year}-07-25`]: "Santiago Apóstol",
    [`${year}-11-09`]: "Nuestra Señora de la Almudena",
  };

  return holidays[date] ?? null;
}

export function getCompanyHolidayName(date: string) {
  const year = Number(date.slice(0, 4));
  const holidays: Record<string, string> = {
    [`${year}-12-24`]: "Vacaciones Solera",
    [`${year}-12-31`]: "Vacaciones Solera",
  };

  return holidays[date] ?? null;
}

export function getHolidayName(date: string) {
  return getSpanishNationalHolidayName(date) ?? getMadridHolidayName(date) ?? getCompanyHolidayName(date);
}

export function isHoliday(date: string) {
  return getHolidayName(date) !== null;
}

export function getCalendarDays(year: number, month: number) {
  const monthIndex = month - 1;
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const firstWeekday = firstDay.getUTCDay() === 0 ? 6 : firstDay.getUTCDay() - 1;
  const cells: CalendarCell[] = Array.from({ length: firstWeekday }, () => null);
  const today = getTodayDateKey();

  for (let day = 1; day <= lastDay.getUTCDate(); day += 1) {
    const date = toDateKey(new Date(Date.UTC(year, monthIndex, day)));
    const holidayName = getHolidayName(date);

    cells.push({
      date,
      dayNumber: day,
      holidayName,
      isHoliday: holidayName !== null,
      isToday: date === today,
      isWeekend: isWeekendDateKey(date),
    });
  }

  return { cells, monthName: firstDay.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) };
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function formatDateKeyForDisplay(value: string) {
  if (!isValidDateKey(value)) {
    return "Fecha no válida";
  }

  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}
