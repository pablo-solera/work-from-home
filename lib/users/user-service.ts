import { hashPassword } from "@/lib/auth/password";
import { findLdapUserDn, verifyLdapCredentials } from "@/lib/auth/ldap";
import type { SessionUser } from "@/lib/auth/session";
import { findActiveEmployeeByEmail } from "@/lib/employees/employee-repository";
import { resolveUserRole } from "@/lib/employees/org-service";
import { findTestAccountByEmail, verifyTestAccountPassword } from "@/lib/employees/test-accounts";
import { generateTemporaryPassword } from "./password-generator";
import { deleteUser, findUserByFallbackEmail, findUserById, findUserByOracleEmpId, updateUser, updateUserPassword } from "./user-repository";

type UpdateUserInput = {
  canEditAllWfh: boolean;
  hasWfh: boolean;
  id: string;
  wfhDaysAllowance: number | null;
};

type ChangePasswordInput = {
  id: string;
  password?: string;
  passwordMode: "generate" | "manual";
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

export async function updateUserById(_actor: SessionUser, input: Omit<UpdateUserInput, "coordinatorId" | "role">) {
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

export async function changeUserPassword(input: ChangePasswordInput) {
  const user = await findUserById(input.id);

  if (!user) {
    return { error: "El usuario no existe." };
  }

  if (input.passwordMode === "manual" && !input.password) {
    return { error: "Escribe una contraseña de al menos 8 caracteres o elige generar una temporal." };
  }

  const generatedPassword = input.passwordMode === "generate" ? generateTemporaryPassword() : undefined;
  const password = generatedPassword ?? input.password;

  if (!password) {
    return { error: "No se pudo determinar la nueva contraseña." };
  }

  await updateUserPassword(input.id, await hashPassword(password));

  return {
    generatedPassword,
    message: generatedPassword ? "Contraseña temporal generada correctamente." : "Contraseña actualizada correctamente.",
    ok: true,
  };
}

export async function deleteUserById(actor: SessionUser, id: string) {
  if (actor.id === id) {
    return { error: "No puedes eliminar tu propia cuenta." };
  }

  const user = await findUserById(id);

  if (!user) {
    return { error: "El usuario no existe." };
  }

  await deleteUser(id);

  return { message: "Usuario eliminado correctamente.", ok: true };
}
