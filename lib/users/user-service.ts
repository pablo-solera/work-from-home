import type { UserRole } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import { findActiveEmployeeByEmail } from "@/lib/employees/employee-repository";
import { generateTemporaryPassword } from "./password-generator";
import { deleteUser, findUserByFallbackEmail, findUserById, findUserByOracleEmpId, updateUser, updateUserPassword } from "./user-repository";

type UpdateUserInput = {
  canEditAllWfh: boolean;
  coordinatorId?: string;
  hasWfh: boolean;
  id: string;
  role: UserRole;
  wfhDaysAllowance: number | null;
  wdNumber: string | null;
};

type ChangePasswordInput = {
  id: string;
  password?: string;
  passwordMode: "generate" | "manual";
};

/**
 * Authenticates by email + password. Identity lives in Oracle (TIMERTASK):
 * the email is resolved against the active staff to obtain the employee, whose
 * credentials are then verified against Postgres. System accounts (no Oracle
 * employee) authenticate via fallback_email so they do not depend on Oracle.
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

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return null;
    }

    return {
      id: user.id,
      name: oracleEmployee.name,
      email: oracleEmployee.email,
      role: user.role,
    };
  }

  // 2. Fall back to a system account (admin, etc.).
  const systemUser = await findUserByFallbackEmail(normalizedEmail);

  if (!systemUser || !(await verifyPassword(password, systemUser.passwordHash))) {
    return null;
  }

  return {
    id: systemUser.id,
    name: systemUser.fallbackName ?? normalizedEmail,
    email: systemUser.fallbackEmail ?? normalizedEmail,
    role: systemUser.role,
  };
}

async function resolveCoordinatorId(role: UserRole, coordinatorId?: string) {
  if (role !== "employee") {
    return null;
  }

  if (!coordinatorId) {
    return null;
  }

  const coordinator = await findUserById(coordinatorId);

  if (!coordinator || coordinator.role !== "coordinator") {
    throw new Error("El coordinador seleccionado no es válido.");
  }

  return coordinator.id;
}

export async function updateUserById(actor: SessionUser, input: UpdateUserInput) {
  const user = await findUserById(input.id);

  if (!user) {
    return { error: "El usuario no existe." };
  }

  if (actor.id === input.id && input.role !== "admin") {
    return { error: "No puedes quitarte a ti mismo el rol admin." };
  }

  if (input.coordinatorId === input.id) {
    return { error: "Un usuario no puede ser su propio coordinador." };
  }

  try {
    await updateUser(input.id, {
      canEditAllWfh: input.canEditAllWfh,
      coordinatorId: await resolveCoordinatorId(input.role, input.coordinatorId),
      hasWfh: input.hasWfh,
      role: input.role,
      wfhDaysAllowance: input.wfhDaysAllowance,
      wdNumber: input.wdNumber,
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
