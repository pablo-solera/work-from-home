import { findEmployeesByIds } from "./employee-repository";

export type UserIdentityInput = {
  id: string;
  oracleEmpId: number | null;
  fallbackName: string | null;
  fallbackEmail: string | null;
};

export type ResolvedIdentity = {
  name: string;
  email: string | null;
  wdNumber: string | null;
};

/**
 * Resolves display identity (name/email/wdNumber) for a set of Postgres users,
 * reading from Oracle in a single batch for those mapped to an employee. Users
 * without an Oracle employee use their fallback fields. If Oracle is unavailable,
 * mapped users degrade to their fallback or a generic label so the UI keeps working.
 *
 * Returns a Map keyed by the Postgres user id.
 */
export async function resolveUserIdentities(usersInput: UserIdentityInput[]): Promise<Map<string, ResolvedIdentity>> {
  const empIds = usersInput.map((user) => user.oracleEmpId).filter((id): id is number => id !== null && id !== undefined);

  let employeesById = new Map<number, { name: string; email: string; wdNumber: string | null }>();

  if (empIds.length > 0) {
    try {
      const employees = await findEmployeesByIds(empIds);
      employeesById = new Map(Array.from(employees.entries()).map(([empId, employee]) => [empId, { name: employee.name, email: employee.email, wdNumber: employee.wdNumber }]));
    } catch (error) {
      console.error("Failed to resolve employee identities from Oracle:", error);
    }
  }

  const identities = new Map<string, ResolvedIdentity>();

  for (const user of usersInput) {
    if (user.oracleEmpId !== null && user.oracleEmpId !== undefined) {
      const employee = employeesById.get(user.oracleEmpId);

      identities.set(user.id, {
        name: employee?.name ?? user.fallbackName ?? `Empleado ${user.oracleEmpId}`,
        email: employee?.email ?? user.fallbackEmail ?? null,
        wdNumber: employee?.wdNumber ?? null,
      });

      continue;
    }

    identities.set(user.id, {
      name: user.fallbackName ?? user.fallbackEmail ?? "Usuario",
      email: user.fallbackEmail ?? null,
      wdNumber: null,
    });
  }

  return identities;
}
