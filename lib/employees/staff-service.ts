import { findStaffEmpIds } from "./employee-repository";

type WithOracleEmpId = {
  oracleEmpId: number | null;
};

/**
 * Filters a list of Postgres users down to the "visible staff": employees that
 * are active and belong to one of the configured staff lines (see
 * ORACLE_STAFF_LINE_IDS). System accounts (no oracleEmpId) are kept only when
 * `includeSystemUsers` is true.
 *
 * If Oracle is unavailable the list is returned unfiltered (mapped users) so the
 * app keeps working instead of showing an empty staff.
 */
export async function filterVisibleStaff<T extends WithOracleEmpId>(users: T[], options: { includeSystemUsers?: boolean } = {}): Promise<T[]> {
  const { includeSystemUsers = false } = options;

  let staffEmpIds: Set<number>;

  try {
    staffEmpIds = await findStaffEmpIds();
  } catch (error) {
    console.error("Failed to load staff lines from Oracle; showing all mapped users:", error);
    return users.filter((user) => includeSystemUsers || (user.oracleEmpId !== null && user.oracleEmpId !== undefined));
  }

  return users.filter((user) => {
    if (user.oracleEmpId === null || user.oracleEmpId === undefined) {
      return includeSystemUsers;
    }

    return staffEmpIds.has(user.oracleEmpId);
  });
}
