import { TtlCache } from "@/lib/cache/ttl-cache";
import { findEmployeesByIds, type OracleEmployee } from "./employee-repository";

const IDENTITY_CACHE_TTL_MS = 15 * 60 * 1000;
const MISSING_IDENTITY_TTL_MS = 5 * 60 * 1000;
const ORACLE_UNAVAILABLE_TTL_MS = 30 * 1000;

type CachedIdentity = {
  employee: OracleEmployee | null;
  status: "found" | "missing" | "unavailable";
};

declare global {
  var __wfhEmployeeIdentityCache: TtlCache<number, CachedIdentity> | undefined;
}

const identityCache = globalThis.__wfhEmployeeIdentityCache ?? new TtlCache<number, CachedIdentity>();
globalThis.__wfhEmployeeIdentityCache = identityCache;

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

function cacheTtl(value: CachedIdentity) {
  if (value.status === "found") return IDENTITY_CACHE_TTL_MS;
  return value.status === "missing" ? MISSING_IDENTITY_TTL_MS : ORACLE_UNAVAILABLE_TTL_MS;
}

async function loadIdentities(empIds: number[]) {
  try {
    const employeesById = await findEmployeesByIds(empIds);
    return new Map(empIds.map((empId) => {
      const employee = employeesById.get(empId) ?? null;
      return [empId, { employee, status: employee ? "found" : "missing" }] as const;
    }));
  } catch (error) {
    console.error("Failed to resolve employee identities from Oracle:", error);
    return new Map(empIds.map((empId) => [empId, { employee: null, status: "unavailable" }] as const));
  }
}

export async function resolveUserIdentities(usersInput: UserIdentityInput[]): Promise<Map<string, ResolvedIdentity>> {
  const empIds = [...new Set(usersInput.map((user) => user.oracleEmpId).filter((id): id is number => id !== null && id !== undefined))];
  const cached = await identityCache.getMany(empIds, loadIdentities, cacheTtl);
  const identities = new Map<string, ResolvedIdentity>();

  for (const user of usersInput) {
    if (user.oracleEmpId !== null && user.oracleEmpId !== undefined) {
      const employee = cached.get(user.oracleEmpId)?.employee;
      identities.set(user.id, {
        name: employee?.name ?? user.fallbackName ?? `Empleado ${user.oracleEmpId}`,
        email: employee?.email ?? user.fallbackEmail ?? null,
        wdNumber: employee?.wdNumber ?? null,
      });
      continue;
    }

    identities.set(user.id, { name: user.fallbackName ?? user.fallbackEmail ?? "Usuario", email: user.fallbackEmail ?? null, wdNumber: null });
  }

  return identities;
}
