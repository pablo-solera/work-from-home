import type { SessionUser } from "@/lib/auth/session";
import { getAbsenceSectionsByDate } from "@/lib/absences/absence-service";
import { getMadridTodayDateKey, isValidDateKey, isWeekendDateKey } from "@/lib/calendar/dates";
import { getHolidayDates } from "@/lib/calendar/holiday-service";
import { findWorkFromHomeDaysByUserIds } from "@/lib/calendar/calendar-repository";
import { addDateKey } from "@/lib/calendar/dates";
import { getVisibleAssistantEmployeeRecords } from "./employee-lookup";
import { formatAssistantDate } from "./assistant-format";
import { validateAssistantRange } from "./assistant-policy";

const ABSENCE_LABELS: Record<string, string> = {
  vacaciones: "vacaciones",
  ausencias: "ausencia",
  viajes: "viaje",
  permisos: "permiso",
  excedencia: "excedencia",
  mudanza: "mudanza",
};

export async function getEmployeeDayStatus(actor: SessionUser, employeeId: string, date: string) {
  if (!isValidDateKey(date)) return { error: "La fecha no es válida." };
  const employee = (await getVisibleAssistantEmployeeRecords(actor)).find((match) => match.id === employeeId);
  if (!employee) return { error: "Ese empleado no está dentro de tu ámbito de consulta." };

  if ((await getHolidayDates(date, date)).has(date)) return { employee, date, label: formatAssistantDate(date), status: "festivo" as const, detail: "Festivo" };
  if (isWeekendDateKey(date)) return { employee, date, label: formatAssistantDate(date), status: "fin de semana" as const };

  const users = [{ id: employee.id, oracleEmpId: employee.oracleEmpId, fallbackName: employee.name, fallbackEmail: employee.email }];
  const [wfhDays, absences] = await Promise.all([
    findWorkFromHomeDaysByUserIds([employee.id], date, date),
    getAbsenceSectionsByDate(date, date, users),
  ]);
  const sections = absences[date];
  const absence = sections ? Object.entries(sections).find(([key, entries]) => key !== "enOficina" && key !== "teletrabajo" && entries.some((entry) => entry.userId === employee.id)) : undefined;

  if (absence) return { employee, date, label: formatAssistantDate(date), status: "ausente" as const, detail: ABSENCE_LABELS[absence[0]] ?? "ausencia" };
  if (wfhDays.some((entry) => entry.date === date)) return { employee, date, label: formatAssistantDate(date), status: "teletrabajo" as const };
  return { employee, date, label: formatAssistantDate(date), status: "en oficina" as const };
}

export async function getEmployeeRangeStatus(actor: SessionUser, employeeId: string, from: string, to: string) {
  const range = validateAssistantRange(from, to);
  if ("error" in range) return range;
  const employee = (await getVisibleAssistantEmployeeRecords(actor)).find((match) => match.id === employeeId);
  if (!employee) return { error: "Ese empleado no está dentro de tu ámbito de consulta." };

  const users = [{ id: employee.id, oracleEmpId: employee.oracleEmpId, fallbackName: employee.name, fallbackEmail: employee.email }];
  const [wfhDays, absences, holidays] = await Promise.all([
    findWorkFromHomeDaysByUserIds([employee.id], from, to),
    getAbsenceSectionsByDate(from, to, users),
    getHolidayDates(from, to),
  ]);
  const wfhDates = new Set(wfhDays.map((entry) => entry.date));
  const statuses = [];

  for (let date = from; date <= to; date = addDateKey(date, 1)) {
    if (holidays.has(date)) {
      statuses.push({ date, label: formatAssistantDate(date), status: "festivo" as const, detail: "Festivo" });
      continue;
    }
    if (isWeekendDateKey(date)) {
      statuses.push({ date, label: formatAssistantDate(date), status: "fin de semana" as const });
      continue;
    }
    const sections = absences[date];
    const absence = sections ? Object.entries(sections).find(([key, entries]) => key !== "enOficina" && key !== "teletrabajo" && entries.some((entry) => entry.userId === employee.id)) : undefined;
    if (absence) statuses.push({ date, label: formatAssistantDate(date), status: "ausente" as const, detail: ABSENCE_LABELS[absence[0]] ?? "ausencia" });
    else statuses.push({ date, label: formatAssistantDate(date), status: wfhDates.has(date) ? "teletrabajo" as const : "en oficina" as const });
  }

  return { employee, from, to, statuses };
}

export function assistantTodayContext() {
  return getMadridTodayDateKey();
}
