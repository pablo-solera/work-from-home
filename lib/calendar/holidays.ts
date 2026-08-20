import { toDateKey } from "./date-utils";

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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateKey(new Date(Date.UTC(year, month - 1, day)));
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function getSpanishNationalHolidayName(date: string) {
  const year = Number(date.slice(0, 4));
  const fixedHolidays: Record<string, string> = {
    [`${year}-01-01`]: "Año Nuevo", [`${year}-01-06`]: "Epifanía del Señor", [`${year}-05-01`]: "Día del Trabajo",
    [`${year}-08-15`]: "Asunción de la Virgen", [`${year}-10-12`]: "Fiesta Nacional de España", [`${year}-11-01`]: "Todos los Santos",
    [`${year}-12-06`]: "Día de la Constitución", [`${year}-12-08`]: "Inmaculada Concepción", [`${year}-12-25`]: "Navidad",
  };
  return fixedHolidays[date] ?? (date === addDays(getEasterSundayDateKey(year), -2) ? "Viernes Santo" : null);
}

export function isSpanishNationalHoliday(date: string) {
  return getSpanishNationalHolidayName(date) !== null;
}

export function getMadridHolidayName(date: string) {
  const year = Number(date.slice(0, 4));
  const holidays: Record<string, string> = {
    [`${year}-05-02`]: "Día de la Comunidad de Madrid", [`${year}-05-15`]: "San Isidro",
    [`${year}-07-25`]: "Santiago Apóstol", [`${year}-11-09`]: "Nuestra Señora de la Almudena",
  };
  return holidays[date] ?? null;
}

export function getCompanyHolidayName(date: string) {
  const year = Number(date.slice(0, 4));
  const holidays: Record<string, string> = { [`${year}-12-24`]: "Vacaciones Solera", [`${year}-12-31`]: "Vacaciones Solera" };
  return holidays[date] ?? null;
}

export function getHolidayName(date: string) {
  return getSpanishNationalHolidayName(date) ?? getMadridHolidayName(date) ?? getCompanyHolidayName(date);
}

export function isHoliday(date: string) {
  return getHolidayName(date) !== null;
}
