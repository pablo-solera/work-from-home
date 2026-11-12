import type { SessionUser } from "@/lib/auth/session";
import { getCalendarDayDetailForUsers } from "@/lib/calendar/calendar-read-service";
import { getDashboardCalendarOverview } from "@/lib/calendar/dashboard-calendar-service";
import { getAssistantVisibleUsers } from "./assistant-scope";
import { formatAssistantDate } from "./assistant-format";
import { validateAssistantDate, validateAssistantRange } from "./assistant-policy";
import { getHolidayDates } from "@/lib/calendar/holiday-service";

type AssistantStatus = "en oficina" | "teletrabajo" | "ausente";

export async function getAssistantDaySummary(actor: SessionUser, date: string) {
  const valid = validateAssistantDate(date);
  if ("error" in valid) return valid;
  const sections = await loadAssistantDaySections(actor, date);
  if (!sections) return { error: "No tienes permiso para consultar ese día." };
  return buildAssistantDaySummary(date, sections);
}

async function buildAssistantDaySummary(date: string, sections: Awaited<ReturnType<typeof getCalendarDayDetailForUsers>>) {
  if (!sections) return { error: "No tienes permiso para consultar ese día." };
  const holiday = (await getHolidayDates(date, date)).has(date) ? "Festivo" : null;
  return {
    date,
    label: formatAssistantDate(date),
    officeCount: sections.enOficina.length,
    remoteCount: sections.teletrabajo.length,
    absenceCount: [sections.vacaciones, sections.ausencias, sections.bajas, sections.viajes, sections.permisos, sections.excedencia, sections.mudanza].reduce((count, entries) => count + entries.length, 0),
    holiday,
    peopleInOffice: sections.enOficina.map((entry) => entry.userName),
    peopleRemote: sections.teletrabajo.map((entry) => entry.userName),
  };
}

async function loadAssistantDaySections(actor: SessionUser, date: string) {
  const users = await getAssistantVisibleUsers(actor);
  return users ? getCalendarDayDetailForUsers(users, date) : null;
}

export async function getAssistantDayOverview(actor: SessionUser, date: string, status?: AssistantStatus) {
  const valid = validateAssistantDate(date);
  if ("error" in valid) return valid;
  const sections = await loadAssistantDaySections(actor, date);
  if (!sections) return { error: "No tienes permiso para consultar ese día." };
  const summary = await buildAssistantDaySummary(date, sections);
  if (!status) return summary;
  const entries = status === "en oficina" ? sections.enOficina : status === "teletrabajo" ? sections.teletrabajo : [...sections.vacaciones, ...sections.ausencias, ...sections.viajes, ...sections.permisos, ...sections.excedencia, ...sections.mudanza];
  return { ...summary, status, people: entries.map((entry) => entry.userName) };
}

export async function getAssistantRangeOverview(actor: SessionUser, from: string, to: string) {
  const range = validateAssistantRange(from, to);
  if ("error" in range) return range;
  if (!await getAssistantVisibleUsers(actor)) return { error: "No tienes permiso para consultar este ámbito." };
  const months = new Set<string>();
  months.add(from.slice(0, 7));
  months.add(to.slice(0, 7));
  const overviews = await Promise.all([...months].map((month) => getDashboardCalendarOverview("admin", actor, Number(month.slice(0, 4)), Number(month.slice(5, 7)))));
  const summaries = overviews.flatMap((overview) => overview?.daySummariesByDate ? Object.values(overview.daySummariesByDate) : []).filter((summary) => summary.date >= from && summary.date <= to);
  return { from, to, days: summaries.map((summary) => ({ date: summary.date, label: formatAssistantDate(summary.date), officeCount: summary.officeCount, remoteCount: summary.remoteCount, absenceCount: summary.absenceCount })) };
}
