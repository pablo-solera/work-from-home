import { findEmployeesByIds } from "./employee-repository";

const IDENTITY_CACHE_TTL_MS = 15 * 60 * 1000;

type CachedEmployee = {
  email: string;
  expiresAt: number;
  name: string;
  wdNumber: string | null;
};

const employeeIdentityCache = new Map<number, CachedEmployee>();

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
  const empIds = [...new Set(usersInput
    .map((user) => user.oracleEmpId)
    .filter((id): id is number => id !== null && id !== undefined))];
  const now = Date.now();
  const missingEmpIds = empIds.filter((empId) => {
    const cached = employeeIdentityCache.get(empId);
    return !cached || cached.expiresAt <= now;
  });

  const employeesById = new Map<number, { name: string; email: string; wdNumber: string | null }>();

  if (missingEmpIds.length > 0) {
    try {
      const employees = await findEmployeesByIds(missingEmpIds);
      for (const [empId, employee] of employees) {
        employeeIdentityCache.set(empId, {
          email: employee.email,
          expiresAt: now + IDENTITY_CACHE_TTL_MS,
          name: employee.name,
          wdNumber: employee.wdNumber,
        });
      }
    } catch (error) {
      console.error("Failed to resolve employee identities from Oracle:", error);
    }
  }

  for (const empId of empIds) {
    const cached = employeeIdentityCache.get(empId);
    if (cached && cached.expiresAt > now) {
      employeesById.set(empId, cached);
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
