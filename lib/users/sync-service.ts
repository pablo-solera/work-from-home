import { findAllActiveEmployees } from "@/lib/employees/employee-repository";
import { getTestAccountEmpIds } from "@/lib/employees/test-accounts";
import { applyUserSync, countWorkFromHomeDaysByUserIds, findUsersWithOracleEmpId } from "@/lib/users/user-repository";

// Oracle employees that are not real people and must never become app users.
const IGNORED_EMP_IDS = new Set<number>([
  3425, // "Administrador Unico" - system account in Oracle
]);

export type SyncPlan = {
  mappedUserCount: number;
  toReactivate: { userId: string; empId: number }[];
  toCreate: { empId: number; name: string; email: string }[];
  toDelete: { userId: string; empId: number; wfhDays: number }[];
};

export type SyncResult = {
  created: number;
  deactivated: number;
};

/**
 * Reconciles the app users (PostgreSQL) against the active employees in Oracle:
 * plans which active employees are missing (to create) and which mapped users
 * are no longer active employees (to deactivate). Read-only; does not modify data.
 */
export async function buildSyncPlan(): Promise<SyncPlan> {
  const [employees, mappedUsers] = await Promise.all([findAllActiveEmployees(), findUsersWithOracleEmpId()]);

  const activeEmpIds = new Set(employees.map((employee) => employee.empId));
  const mappedEmpIds = new Set(mappedUsers.map((user) => user.oracleEmpId as number));

  const toCreate = employees
    .filter((employee) => !IGNORED_EMP_IDS.has(employee.empId) && !mappedEmpIds.has(employee.empId))
    .map((employee) => ({ empId: employee.empId, name: employee.name, email: employee.email }));

  const testAccountEmpIds = getTestAccountEmpIds();
  const toReactivate = mappedUsers
    .filter((user) => user.deactivatedAt && activeEmpIds.has(user.oracleEmpId as number) && !IGNORED_EMP_IDS.has(user.oracleEmpId as number))
    .map((user) => ({ userId: user.id, empId: user.oracleEmpId as number }));
  const usersToDelete = mappedUsers.filter((user) => !user.deactivatedAt && !testAccountEmpIds.has(user.oracleEmpId as number) && !activeEmpIds.has(user.oracleEmpId as number));

  // Count WFH days that would be lost per user to be deleted.
  const deleteIds = usersToDelete.map((user) => user.id);
  const wfhCounts = new Map<string, number>();

  if (deleteIds.length > 0) {
    const rows = await countWorkFromHomeDaysByUserIds(deleteIds);
    for (const row of rows) {
      wfhCounts.set(row.userId, Number(row.count));
    }
  }

  const toDelete = usersToDelete.map((user) => ({ userId: user.id, empId: user.oracleEmpId as number, wfhDays: wfhCounts.get(user.id) ?? 0 }));

  return { mappedUserCount: mappedUsers.filter((user) => !user.deactivatedAt).length, toCreate, toDelete, toReactivate };
}

/**
 * Applies the sync: creates missing employees and deactivates users that are no
 * longer active employees while preserving their historical records.
 */
export async function runUserSync(plan?: SyncPlan): Promise<SyncResult> {
  const syncPlan = plan ?? await buildSyncPlan();
  if (syncPlan.mappedUserCount > 0 && syncPlan.toDelete.length > Math.max(5, Math.ceil(syncPlan.mappedUserCount * 0.1))) {
    throw new Error("La sincronización supera el umbral de bajas permitido; requiere revisión manual.");
  }

  const result = await applyUserSync(
    syncPlan.toCreate.map((employee) => ({ oracleEmpId: employee.empId, hasWfh: false })),
    syncPlan.toReactivate.map((entry) => entry.userId),
    syncPlan.toDelete.map((entry) => entry.userId),
  );

  return { created: result.created.length, deactivated: result.deactivated.length };
}
