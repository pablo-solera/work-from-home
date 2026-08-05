import { findEmployeesByIds, type OracleEmployee } from "./employee-repository";

const IDENTITY_CACHE_TTL_MS = 15 * 60 * 1000;
const MISSING_IDENTITY_TTL_MS = 5 * 60 * 1000;
const ORACLE_UNAVAILABLE_TTL_MS = 30 * 1000;

type CachedIdentity = {
  employee: OracleEmployee | null;
  expiresAt: number;
  status: "found" | "missing" | "unavailable";
};

type IdentityCacheState = {
  entries: Map<number, CachedIdentity>;
  loading: Promise<void> | null;
};

declare global {
  var __wfhEmployeeIdentityCache: IdentityCacheState | undefined;
}

const state: IdentityCacheState = globalThis.__wfhEmployeeIdentityCache ?? {
  entries: new Map(),
  loading: null,
};
globalThis.__wfhEmployeeIdentityCache = state;

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

async function loadMissingIdentities(empIds: number[]) {
  if (state.loading) {
    await state.loading;
    return loadMissingIdentities(empIds);
  }

  const now = Date.now();
  const idsToLoad = empIds.filter((empId) => {
    const cached = state.entries.get(empId);
    return !cached || cached.expiresAt <= now;
  });

  if (idsToLoad.length === 0) return;

  const loading = findEmployeesByIds(idsToLoad)
    .then((employeesById) => {
      const loadedAt = Date.now();
      for (const empId of idsToLoad) {
        const employee = employeesById.get(empId) ?? null;
        state.entries.set(empId, {
          employee,
          expiresAt: loadedAt + (employee ? IDENTITY_CACHE_TTL_MS : MISSING_IDENTITY_TTL_MS),
          status: employee ? "found" : "missing",
        });
      }
    })
    .catch((error) => {
      console.error("Failed to resolve employee identities from Oracle:", error);
      const unavailableUntil = Date.now() + ORACLE_UNAVAILABLE_TTL_MS;
      for (const empId of idsToLoad) {
        state.entries.set(empId, { employee: null, expiresAt: unavailableUntil, status: "unavailable" });
      }
    })
    .finally(() => {
      state.loading = null;
    });
  state.loading = loading;

  await loading;
}

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
    const cached = state.entries.get(empId);
    return !cached || cached.expiresAt <= now;
  });

  if (missingEmpIds.length > 0) {
    await loadMissingIdentities(missingEmpIds);
  }

  const identities = new Map<string, ResolvedIdentity>();

  for (const user of usersInput) {
    if (user.oracleEmpId !== null && user.oracleEmpId !== undefined) {
      const cached = state.entries.get(user.oracleEmpId);
      const employee = cached && cached.expiresAt > Date.now() && cached.status === "found" ? cached.employee : null;

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
