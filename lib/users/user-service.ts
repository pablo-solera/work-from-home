import { findLdapUserDn, verifyLdapCredentials } from "@/lib/auth/ldap";
import type { SessionUser } from "@/lib/auth/session";
import { findActiveEmployeeByEmail } from "@/lib/employees/employee-repository";
import { resolveUserRole } from "@/lib/employees/org-service";
import { findTestAccountByEmail, verifyTestAccountPassword } from "@/lib/employees/test-accounts";
import { cache } from "react";
import { findUserByFallbackEmail, findUserById, findUserByOracleEmpId, updateUser } from "./user-repository";

export const getUserById = cache((id: string) => findUserById(id));

type UpdateUserInput = {
  canEditAllWfh: boolean;
  hasWfh: boolean;
  id: string;
  wfhDaysAllowance: number | null;
};

/**
 * Authenticates by email + password. Identity lives in Oracle (TIMERTASK):
 * the email is resolved against the active staff to obtain the employee.
 * Corporate employees' credentials are verified against LDAP (Active
 * Directory); explicitly configured test accounts use the shared local test
 * password instead.
 */
export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Try an active Oracle employee with this email.
  let oracleEmployee = null;

  try {
    oracleEmployee = await findActiveEmployeeByEmail(normalizedEmail);
  } catch (error) {
    console.error("Failed to resolve employee from Oracle during login:", error);
  }

  if (oracleEmployee) {
    const user = await findUserByOracleEmpId(oracleEmployee.empId);

    if (!user) {
      return null;
    }

    const ldapDn = await findLdapUserDn(oracleEmployee.email);

    if (!ldapDn || !(await verifyLdapCredentials(ldapDn, password))) {
      return null;
    }

    return {
      id: user.id,
      name: oracleEmployee.name,
      email: oracleEmployee.email,
       role: await resolveUserRole(user),
    };
  }

  // 2. Test accounts are the only local accounts allowed to bypass AD.
  const testAccount = findTestAccountByEmail(normalizedEmail);
  if (!testAccount || !verifyTestAccountPassword(password)) return null;

  const systemUser = await findUserByFallbackEmail(normalizedEmail);

  if (!systemUser || systemUser.oracleEmpId !== testAccount.empId) {
    return null;
  }

  return {
    id: systemUser.id,
    name: systemUser.fallbackName ?? normalizedEmail,
    email: systemUser.fallbackEmail ?? normalizedEmail,
    role: await resolveUserRole(systemUser),
  };
}

export async function updateUserById(_actor: SessionUser, input: UpdateUserInput) {
  const user = await findUserById(input.id);

  if (!user) {
    return { error: "El usuario no existe." };
  }

  try {
    await updateUser(input.id, {
      canEditAllWfh: input.canEditAllWfh,
      hasWfh: input.hasWfh,
      wfhDaysAllowance: input.wfhDaysAllowance,
    });

    return { message: "Usuario actualizado correctamente.", ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el usuario." };
  }
}
