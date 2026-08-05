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

/**
 * Reads absences from Oracle for the given range and groups them per date and
 * section. Each absence already carries the Oracle employee name; it is linked
 * to a Postgres user by `oracleEmpId` (so the app can reference the user id).
 *
 * If Oracle is unreachable the function degrades gracefully to empty sections
 * so the teletrabajo view keeps working.
 *
 * `users` can be passed in by callers that already loaded the user list (e.g.
 * the calendar overview) to avoid a redundant Postgres query.
 */
export async function getAbsenceSectionsByDate(start: string, end: string, users?: CalendarUser[]): Promise<Record<string, DaySections>> {
  try {
    return groupAbsencesByDate(await findAbsencesByDateRange(start, end), users);
  } catch (error) {
    console.error("Failed to read absences from Oracle:", error);
    return {};
  }
}

/** Same grouping as the calendar view, but propagates Oracle failures. */
export async function getAbsenceSectionsByDateStrict(start: string, end: string, users?: CalendarUser[]): Promise<Record<string, DaySections>> {
  return groupAbsencesByDate(await findAbsencesByDateRange(start, end), users);
}

export { createEmptySections };
