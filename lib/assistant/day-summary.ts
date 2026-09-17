import type { SessionUser } from "@/lib/auth/session";
import { getCalendarDayDetailForUsers } from "@/lib/calendar/calendar-read-service";
import { getCalendarDays } from "@/lib/calendar/dates";
import { getDashboardCalendarOverview } from "@/lib/calendar/dashboard-calendar-service";
import { getAssistantVisibleUsers } from "./assistant-scope";
import { formatAssistantDate } from "./assistant-format";
import { validateAssistantDate, validateAssistantRange } from "./assistant-policy";

type AssistantStatus = "en oficina" | "teletrabajo" | "ausente";

export async function getAssistantDaySummary(actor: SessionUser, date: string) {
  const valid = validateAssistantDate(date);
  if ("error" in valid) return valid;
  const users = await getAssistantVisibleUsers(actor);
  const sections = users ? await getCalendarDayDetailForUsers(users, date) : null;
  if (!sections) return { error: "No tienes permiso para consultar ese día." };
  const calendar = getCalendarDays(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const cell = calendar.cells.find((entry) => entry?.date === date);
  return {
    date,
    label: formatAssistantDate(date),
    officeCount: sections.enOficina.length,
    remoteCount: sections.teletrabajo.length,
    absenceCount: [sections.vacaciones, sections.ausencias, sections.bajas, sections.viajes, sections.permisos, sections.excedencia, sections.mudanza].reduce((count, entries) => count + entries.length, 0),
    holiday: cell?.holidayName ?? null,
    peopleInOffice: sections.enOficina.map((entry) => entry.userName),
    peopleRemote: sections.teletrabajo.map((entry) => entry.userName),
  };
}

export async function getAssistantDayOverview(actor: SessionUser, date: string, status?: AssistantStatus) {
  const summary = await getAssistantDaySummary(actor, date);
  if ("error" in summary) return summary;
  if (!status) return summary;
  const users = await getAssistantVisibleUsers(actor);
  const sections = users ? await getCalendarDayDetailForUsers(users, date) : null;
  if (!sections) return { error: "No tienes permiso para consultar ese día." };
  const entries = status === "en oficina" ? sections.enOficina : status === "teletrabajo" ? sections.teletrabajo : [...sections.vacaciones, ...sections.ausencias, ...sections.bajas, ...sections.viajes, ...sections.permisos, ...sections.excedencia, ...sections.mudanza];
  return { ...summary, status, people: entries.map((entry) => entry.userName) };
}

export async function getAssistantRangeOverview(actor: SessionUser, from: string, to: string) {
  const range = validateAssistantRange(from, to);
  if ("error" in range) return range;
  const months = new Set<string>();
  for (let date = from; date <= to; date = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) months.add(date.slice(0, 7));
  const overviews = await Promise.all([...months].map((month) => getDashboardCalendarOverview("admin", actor, Number(month.slice(0, 4)), Number(month.slice(5, 7)))));
  const summaries = overviews.flatMap((overview) => overview?.daySummariesByDate ? Object.values(overview.daySummariesByDate) : []).filter((summary) => summary.date >= from && summary.date <= to);
  return { from, to, days: summaries.map((summary) => ({ date: summary.date, label: formatAssistantDate(summary.date), officeCount: summary.officeCount, remoteCount: summary.remoteCount, absenceCount: summary.absenceCount })) };
}
