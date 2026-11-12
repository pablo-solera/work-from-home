import { addDateKey, getMadridTodayDateKey, isValidDateKey } from "@/lib/calendar/dates";

export const ASSISTANT_FUTURE_WINDOW_MONTHS = 3;
export const ASSISTANT_MAX_RANGE_DAYS = 31;

function shiftMonths(dateKey: string, months: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function validateAssistantDate(date: string) {
  if (!isValidDateKey(date)) return { error: "La fecha no es válida." } as const;
  const today = getMadridTodayDateKey();
  if (date > shiftMonths(today, ASSISTANT_FUTURE_WINDOW_MONTHS)) {
    return { error: "Solo puedo consultar fechas hasta tres meses hacia adelante." } as const;
  }
  return { date } as const;
}

export function validateAssistantRange(from: string, to: string) {
  const start = validateAssistantDate(from);
  if ("error" in start) return start;
  const end = validateAssistantDate(to);
  if ("error" in end) return end;
  if (to < from) return { error: "La fecha final no puede ser anterior a la fecha inicial." } as const;

  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > ASSISTANT_MAX_RANGE_DAYS) return { error: "Una consulta no puede abarcar más de 31 días." } as const;
  return { from, to, days } as const;
}

export function getAssistantDateRangeContext() {
  const today = getMadridTodayDateKey();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addDateKey(today, mondayOffset);
  return { today, monday, friday: addDateKey(monday, 4) };
}
