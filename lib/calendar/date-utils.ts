export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getTodayDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function getMadridTodayDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid", year: "numeric" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isWeekendDateKey(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function getWeekdayFromDateKey(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function addDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function getWeekRange(date: string) {
  const weekday = getWeekdayFromDateKey(date);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return { start: addDateKey(date, mondayOffset), end: addDateKey(date, mondayOffset + 6) };
}

export function isDateInWeek(date: string, referenceDate: string) {
  const range = getWeekRange(referenceDate);
  return date >= range.start && date <= range.end;
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function formatDateKeyForDisplay(value: string) {
  if (!isValidDateKey(value)) return "Fecha no válida";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}
