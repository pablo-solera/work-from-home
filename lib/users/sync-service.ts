import { hashPassword } from "@/lib/auth/password";
import { findAllActiveEmployees } from "@/lib/employees/employee-repository";
import { getTestAccountEmpIds } from "@/lib/employees/test-accounts";
import { generateTemporaryPassword } from "@/lib/users/password-generator";
import type { SyncPassword } from "@/lib/users/sync-state";
import { countWorkFromHomeDaysByUserIds, createUsers, deleteUsers, findUsersWithOracleEmpId } from "@/lib/users/user-repository";

// Oracle employees that are not real people and must never become app users.
const IGNORED_EMP_IDS = new Set<number>([
  3425, // "Administrador Unico" - system account in Oracle
]);

export type SyncPlan = {
  toCreate: { empId: number; name: string; email: string }[];
  toDelete: { userId: string; empId: number; wfhDays: number }[];
};

export type SyncResult = {
  created: number;
  deleted: number;
  passwords: SyncPassword[];
};

/**
 * Reconciles the app users (PostgreSQL) against the active employees in Oracle:
 * plans which active employees are missing (to create) and which mapped users
 * are no longer active employees (to delete). Read-only; does not modify data.
 */
export async function buildSyncPlan(): Promise<SyncPlan> {
  const [employees, mappedUsers] = await Promise.all([findAllActiveEmployees(), findUsersWithOracleEmpId()]);

  const activeEmpIds = new Set(employees.map((employee) => employee.empId));
  const mappedEmpIds = new Set(mappedUsers.map((user) => user.oracleEmpId as number));

  const toCreate = employees
    .filter((employee) => !IGNORED_EMP_IDS.has(employee.empId) && !mappedEmpIds.has(employee.empId))
    .map((employee) => ({ empId: employee.empId, name: employee.name, email: employee.email }));

  const testAccountEmpIds = getTestAccountEmpIds();
  const usersToDelete = mappedUsers.filter((user) => !testAccountEmpIds.has(user.oracleEmpId as number) && !activeEmpIds.has(user.oracleEmpId as number));

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

  return { toCreate, toDelete };
}

/**
 * Applies the sync: creates missing employees with a temporary password and
 * deletes users that are no longer active employees. Returns the temporary
 * passwords so the caller decides how to deliver them (CSV file, UI, etc.).
 */
export async function runUserSync(): Promise<SyncResult> {
  const plan = await buildSyncPlan();

  // Build each candidate with its empId so passwords stay tied to the right
  // employee regardless of async resolution order (hashing is concurrent).
  const candidates = await Promise.all(
    plan.toCreate.map(async (employee) => {
      const password = generateTemporaryPassword();

      return {
        empId: employee.empId,
        name: employee.name,
        email: employee.email,
        password,
        newUser: {
          oracleEmpId: employee.empId,
          passwordHash: await hashPassword(password),
           hasWfh: false,
        },
      };
    })
  );

  // Concurrency-safe against a parallel sync (cron + on-demand): ignore rows
  // whose oracle_emp_id already exists.
  const created = await createUsers(candidates.map((candidate) => candidate.newUser));

  // Keep only the passwords for users that were actually created, matched by
  // empId (not by array index).
  const createdEmpIds = new Set(created.map((user) => user.oracleEmpId));
  const passwords: SyncPassword[] = candidates
    .filter((candidate) => createdEmpIds.has(candidate.empId))
    .map((candidate) => ({ name: candidate.name, email: candidate.email, password: candidate.password }));

  if (plan.toDelete.length > 0) {
    await deleteUsers(plan.toDelete.map((entry) => entry.userId));
  }

  return { created: created.length, deleted: plan.toDelete.length, passwords };
}
