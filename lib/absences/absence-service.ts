import { TtlCache } from "@/lib/cache/ttl-cache";
import { perfLog } from "@/lib/perf";
import { findAllUsers } from "@/lib/users/user-repository";
import { findAbsencesByDateRange } from "./absence-repository";
import type { AbsenceSectionKey } from "./absence-sections";

type CalendarUser = Awaited<ReturnType<typeof findAllUsers>>[number];
type Absence = Awaited<ReturnType<typeof findAbsencesByDateRange>>[number];

export type CalendarPersonEntry = {
  userId: string | null;
  userName: string;
  userEmail: string | null;
};

export type DaySections = Record<AbsenceSectionKey, CalendarPersonEntry[]>;

function createEmptySections(): DaySections {
  return {
    enOficina: [],
    teletrabajo: [],
    vacaciones: [],
    ausencias: [],
    bajas: [],
    viajes: [],
    permisos: [],
    excedencia: [],
    mudanza: [],
    noComprende: [],
  };
}

async function groupAbsencesByDate(absences: Absence[], users?: CalendarUser[]): Promise<Record<string, DaySections>> {
  if (absences.length === 0) return {};

  const resolvedUsers = users ?? (await findAllUsers());
  const userByOracleId = new Map<number, CalendarUser>();

  for (const user of resolvedUsers) {
    if (user.oracleEmpId !== null && user.oracleEmpId !== undefined) {
      userByOracleId.set(user.oracleEmpId, user);
    }
  }

  const sectionsByDate: Record<string, DaySections> = {};

  for (const absence of absences) {
    const user = userByOracleId.get(absence.empId);
    const entry: CalendarPersonEntry = {
      userId: user?.id ?? null,
      userName: absence.employeeName ?? `Empleado ${absence.empId}`,
      userEmail: null,
    };

    sectionsByDate[absence.date] = sectionsByDate[absence.date] ?? createEmptySections();
    sectionsByDate[absence.date][absence.sectionKey].push(entry);
  }

  return sectionsByDate;
}

// Calendar views read whole months for the whole staff once and filter in memory, instead of
// sending Oracle a different IN (...) query per page and per day detail.
const ABSENCE_MONTH_TTL_MS = 30_000;

declare global {
  var __wfhAbsenceMonthCache: TtlCache<string, Absence[]> | undefined;
}

const absenceMonthCache = globalThis.__wfhAbsenceMonthCache ?? new TtlCache<string, Absence[]>();
globalThis.__wfhAbsenceMonthCache = absenceMonthCache;

function monthKeysBetween(start: string, end: string) {
  const keys: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const lastYear = Number(end.slice(0, 4));
  const lastMonth = Number(end.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

async function loadAbsenceMonths(monthKeys: string[]) {
  const months = await Promise.all(monthKeys.map(async (monthKey) => {
    const lastDay = new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0)).getUTCDate();
    perfLog("section", `absence month cache miss ${monthKey}`);
    return [monthKey, await findAbsencesByDateRange(`${monthKey}-01`, `${monthKey}-${String(lastDay).padStart(2, "0")}`)] as const;
  }));
  return new Map(months);
}

/**
 * Reads absences from Oracle for the given range and groups them per date and
 * section. Each absence already carries the Oracle employee name; it is linked
 * to a Postgres user by `oracleEmpId` (so the app can reference the user id).
 *
 * Absences are cached per month for 30 seconds and filtered here, so opening a
 * day or paging through months does not hit Oracle each time.
 *
 * If Oracle is unreachable the function degrades gracefully to empty sections
 * so the teletrabajo view keeps working.
 *
 * `users` can be passed in by callers that already loaded the user list (e.g.
 * the calendar overview) to avoid a redundant Postgres query.
 */
export async function getAbsenceSectionsByDate(start: string, end: string, users?: CalendarUser[]): Promise<Record<string, DaySections>> {
  try {
    const empIds = new Set(users?.map((user) => user.oracleEmpId).filter((id): id is number => id !== null && id !== undefined) ?? []);
    const months = await absenceMonthCache.getMany(monthKeysBetween(start, end), loadAbsenceMonths, () => ABSENCE_MONTH_TTL_MS);
    const absences = [...months.values()].flat().filter((absence) => absence.date >= start && absence.date <= end && (empIds.size === 0 || empIds.has(absence.empId)));
    return groupAbsencesByDate(absences, users);
  } catch (error) {
    console.error("Failed to read absences from Oracle:", error);
    return {};
  }
}

/** Same grouping as the calendar view, but propagates Oracle failures. */
export async function getAbsenceSectionsByDateStrict(start: string, end: string, users?: CalendarUser[]): Promise<Record<string, DaySections>> {
  const empIds = users?.map((user) => user.oracleEmpId).filter((id): id is number => id !== null && id !== undefined) ?? [];
  return groupAbsencesByDate(await findAbsencesByDateRange(start, end, empIds), users);
}

export { createEmptySections };
