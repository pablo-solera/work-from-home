import { createEmptySections, type DaySections } from "@/lib/absences/absence-service";
import { ABSENCE_SECTIONS } from "@/lib/absences/absence-sections";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { findAllUsers } from "@/lib/users/user-repository";
import { getCalendarDays } from "./dates";

const UNKNOWN_IDENTITY = { name: "Usuario", email: null } as const;

const OUT_OF_OFFICE_SECTION_KEYS = ABSENCE_SECTIONS.map((section) => section.key).filter((key) => key !== "enOficina");
const ABSENCE_ONLY_SECTION_KEYS = ABSENCE_SECTIONS
  .map((section) => section.key)
  .filter((key) => key !== "enOficina" && key !== "teletrabajo" && key !== "noComprende");

export type AdminCalendarDaySummary = {
  absenceCount: number;
  date: string;
  isOutOfRange?: boolean;
  officeCount: number;
  remoteCount: number;
};

export function buildSectionsByDate(
  entries: Array<{ date: string; userId: string }>,
  users: Awaited<ReturnType<typeof findAllUsers>>,
  identities: Awaited<ReturnType<typeof resolveUserIdentities>>,
  absenceSectionsByDate: Record<string, DaySections>,
  calendar: ReturnType<typeof getCalendarDays>,
  excludedEmpIds: Set<number>,
  minimumDate?: string,
  maximumDate?: string,
) {
  const visibleUserIds = new Set(users.map((user) => user.id));
  const excludedUserIds = new Set(users
    .filter((user) => user.oracleEmpId !== null && excludedEmpIds.has(user.oracleEmpId))
    .map((user) => user.id));
  const sectionsByDate: Record<string, DaySections> = {};
  const absentUserIdsByDate: Record<string, Set<string>> = {};

  for (const [date, sections] of Object.entries(absenceSectionsByDate)) {
    if ((minimumDate && date < minimumDate) || (maximumDate && date > maximumDate)) continue;
    const filtered = createEmptySections();
    const absentIds = new Set<string>();

    for (const key of Object.keys(sections) as (keyof DaySections)[]) {
      filtered[key] = sections[key]
        .filter((entry) => entry.userId !== null && visibleUserIds.has(entry.userId) && !excludedUserIds.has(entry.userId))
        .map((entry) => {
          const identity = entry.userId ? identities.get(entry.userId) : undefined;
          return identity ? { ...entry, userName: identity.name, userEmail: identity.email } : entry;
        });

      for (const entry of filtered[key]) {
        if (entry.userId) absentIds.add(entry.userId);
      }
    }

    sectionsByDate[date] = filtered;
    absentUserIdsByDate[date] = absentIds;
  }

  for (const entry of entries) {
    if ((minimumDate && entry.date < minimumDate) || (maximumDate && entry.date > maximumDate)) continue;
    if (!visibleUserIds.has(entry.userId) || excludedUserIds.has(entry.userId) || absentUserIdsByDate[entry.date]?.has(entry.userId)) continue;

    const identity = identities.get(entry.userId) ?? UNKNOWN_IDENTITY;
    sectionsByDate[entry.date] = sectionsByDate[entry.date] ?? createEmptySections();
    sectionsByDate[entry.date].teletrabajo.push({
      userId: entry.userId,
      userName: identity.name,
      userEmail: identity.email,
    });
  }

  const officeStaff = users.filter((user) => user.oracleEmpId !== null && user.oracleEmpId !== undefined && !excludedUserIds.has(user.id));
  const toCalendarEntry = (user: { id: string }) => {
    const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
    return { userId: user.id, userName: identity.name, userEmail: identity.email };
  };
  const excludedEntries = users.filter((user) => excludedUserIds.has(user.id)).map(toCalendarEntry);
  const officeEntries = officeStaff.map(toCalendarEntry).sort((a, b) => a.userName.localeCompare(b.userName, "es"));

  for (const cell of calendar.cells) {
    if (!cell || cell.isWeekend || cell.isHoliday) continue;
    if ((minimumDate && cell.date < minimumDate) || (maximumDate && cell.date > maximumDate)) continue;

    const sections = sectionsByDate[cell.date];
    const outOfOfficeUserIds = new Set<string>();
    sectionsByDate[cell.date] = sectionsByDate[cell.date] ?? createEmptySections();
    sectionsByDate[cell.date].noComprende = excludedEntries;

    if (sections) {
      for (const key of OUT_OF_OFFICE_SECTION_KEYS) {
        for (const entry of sections[key]) {
          if (entry.userId) outOfOfficeUserIds.add(entry.userId);
        }
      }
    }

    const inOffice = officeEntries.filter((entry) => !outOfOfficeUserIds.has(entry.userId));
    if (inOffice.length > 0) sectionsByDate[cell.date].enOficina = inOffice;
  }

  return sectionsByDate;
}

export function buildDaySummaries(sectionsByDate: Record<string, DaySections>, calendar: ReturnType<typeof getCalendarDays>, minimumDate?: string, maximumDate?: string) {
  const summaries: Record<string, AdminCalendarDaySummary> = {};

  for (const cell of calendar.cells) {
    if (!cell) continue;
    const sections = sectionsByDate[cell.date] ?? createEmptySections();
    const isOutOfRange = Boolean((minimumDate && cell.date < minimumDate) || (maximumDate && cell.date > maximumDate));
    const absenceCount = ABSENCE_ONLY_SECTION_KEYS.reduce((total, section) => total + (isOutOfRange ? 0 : sections[section].length), 0);
    summaries[cell.date] = {
      date: cell.date,
      isOutOfRange,
      officeCount: isOutOfRange ? 0 : sections.enOficina.length,
      remoteCount: isOutOfRange ? 0 : sections.teletrabajo.length,
      absenceCount,
    };
  }

  return summaries;
}
