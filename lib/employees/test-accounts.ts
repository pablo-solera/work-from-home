import { createHash, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/lib/auth/session";

export type TestAccount = {
  email: string;
  empId: number;
  role: UserRole;
};

const TEST_ACCOUNT_CONFIG = [
  ["TEST_ACCOUNT_ADMIN", "admin"],
  ["TEST_ACCOUNT_COORDINATOR", "coordinator"],
  ["TEST_ACCOUNT_EMPLOYEE", "employee"],
] as const satisfies readonly [string, UserRole][];

export function getTestAccounts(): TestAccount[] | null {
  if (process.env.TEST_ACCOUNTS_ENABLED !== "true") return null;

  const accounts = TEST_ACCOUNT_CONFIG.map(([variable, role]) => {
    const value = process.env[variable]?.trim();
    const match = value?.match(/^(\d+):([^\s@]+@[^\s@]+)$/);

    if (!match) {
      throw new Error(`${variable} must have the format <employeeId>:<email>.`);
    }

    const empId = Number(match[1]);
    if (!Number.isSafeInteger(empId) || empId <= 0) {
      throw new Error(`${variable} must contain a positive employee id.`);
    }

    return { email: match[2].toLowerCase(), empId, role };
  });

  const empIds = new Set(accounts.map((account) => account.empId));
  const emails = new Set(accounts.map((account) => account.email));
  if (empIds.size !== accounts.length || emails.size !== accounts.length) {
    throw new Error("Test account employee ids and emails must be unique.");
  }

  if (!process.env.TEST_ACCOUNTS_PASSWORD) {
    throw new Error("TEST_ACCOUNTS_PASSWORD must be set when test accounts are enabled.");
  }

  return accounts;
}

export function findTestAccountByEmail(email: string) {
  return getTestAccounts()?.find((account) => account.email === email.trim().toLowerCase()) ?? null;
}

export function findTestAccountByEmpId(empId: number | null) {
  if (empId === null) return null;
  return getTestAccounts()?.find((account) => account.empId === empId) ?? null;
}

export function getTestAccountEmpIds() {
  return new Set(getTestAccounts()?.map((account) => account.empId) ?? []);
}

export function verifyTestAccountPassword(password: string) {
  const configured = process.env.TEST_ACCOUNTS_PASSWORD;
  if (!configured) return false;

  const actualHash = createHash("sha256").update(password).digest();
  const expectedHash = createHash("sha256").update(configured).digest();
  return timingSafeEqual(actualHash, expectedHash);
}
