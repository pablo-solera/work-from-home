import { findAllUsers } from "@/lib/users/user-repository";
import { findAbsencesByDateRange } from "./absence-repository";
import type { AbsenceSectionKey } from "./absence-sections";

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
  };
}

/**
 * Reads absences from Oracle for the given range and groups them per date and
 * section. Each absence already carries the Oracle employee name; it is linked
 * to a Postgres user by `oracleEmpId` (so the app can reference the user id).
 *
 * If Oracle is unreachable the function degrades gracefully to empty sections
 * so the teletrabajo view keeps working.
 */
export async function getAbsenceSectionsByDate(start: string, end: string): Promise<Record<string, DaySections>> {
  let absences: Awaited<ReturnType<typeof findAbsencesByDateRange>> = [];

  try {
    absences = await findAbsencesByDateRange(start, end);
  } catch (error) {
    console.error("Failed to read absences from Oracle:", error);
    return {};
  }

  if (absences.length === 0) {
    return {};
  }

  const users = await findAllUsers();
  const userByOracleId = new Map<number, (typeof users)[number]>();

  for (const user of users) {
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

export { createEmptySections };
