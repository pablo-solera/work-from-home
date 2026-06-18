import type { UserRole } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import { generateTemporaryPassword } from "./password-generator";
import { createUser, createUsers, deleteUser, findUserByEmail, findUserById, findUsersByEmails, updateUser, updateUserPassword } from "./user-repository";
import { isValidEmail, parseBulkEmails } from "./user-validation";

type CreateSingleUserInput = {
  coordinatorId?: string;
  email: string;
  name: string;
  password?: string;
  passwordMode: "generate" | "manual";
  role: UserRole;
};

type UpdateUserInput = {
  canEditAllWfh: boolean;
  coordinatorId?: string;
  email: string;
  hasWfh: boolean;
  id: string;
  name: string;
  role: UserRole;
  wfhDaysAllowance: number | null;
  wdNumber: string | null;
};

type ChangePasswordInput = {
  id: string;
  password?: string;
  passwordMode: "generate" | "manual";
};

export type BulkUserCreationResult = {
  created: Array<{ email: string; password: string }>;
  skipped: Array<{ email: string; reason: string }>;
  invalid: string[];
};

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function createUsersFromEmails(input: string, role: UserRole, coordinatorEmail?: string): Promise<BulkUserCreationResult> {
  const emails = parseBulkEmails(input);
  const invalid = emails.filter((email) => !isValidEmail(email));
  const validEmails = emails.filter((email) => isValidEmail(email));
  const coordinator = coordinatorEmail && role === "employee" ? await findUserByEmail(coordinatorEmail.toLowerCase()) : null;
  const existingUsers = await findUsersByEmails(validEmails);
  const existingEmails = new Set(existingUsers.map((user) => user.email));
  const usersToCreate = validEmails.filter((email) => !existingEmails.has(email));
  const generatedUsers = await Promise.all(
    usersToCreate.map(async (email) => {
      const password = generateTemporaryPassword();

      return {
        email,
        password,
        name: email.split("@")[0] || email,
        passwordHash: await hashPassword(password),
        role,
        coordinatorId: coordinator?.role === "coordinator" ? coordinator.id : null,
      };
    })
  );

  const createdUsers = await createUsers(
    generatedUsers.map(({ name, email, passwordHash, role, coordinatorId }) => ({ name, email, passwordHash, role, coordinatorId }))
  );
  const createdEmails = new Set(createdUsers.map((user) => user.email));

  return {
    created: generatedUsers
      .filter((user) => createdEmails.has(user.email))
      .map((user) => ({ email: user.email, password: user.password })),
    skipped: validEmails
      .filter((email) => existingEmails.has(email) || !createdEmails.has(email))
      .map((email) => ({ email, reason: existingEmails.has(email) ? "Ya existe" : "No se pudo crear" })),
    invalid,
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

export async function createSingleUser(input: CreateSingleUserInput) {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    return { error: "Ya existe un usuario con ese email." };
  }

  if (input.passwordMode === "manual" && !input.password) {
    return { error: "Escribe una contraseña de al menos 8 caracteres o elige generar una temporal." };
  }

  try {
    const coordinatorId = await resolveCoordinatorId(input.role, input.coordinatorId);
    const generatedPassword = input.passwordMode === "generate" ? generateTemporaryPassword() : undefined;
    const password = generatedPassword ?? input.password;

    if (!password) {
      return { error: "No se pudo determinar la contraseña del usuario." };
    }

    await createUser({
      coordinatorId,
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(password),
      role: input.role,
    });

    return {
      generatedPassword,
      message: "Usuario creado correctamente.",
      ok: true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el usuario." };
  }
}

export async function updateUserById(actor: SessionUser, input: UpdateUserInput) {
  const user = await findUserById(input.id);

  if (!user) {
    return { error: "El usuario no existe." };
  }

  if (actor.id === input.id && input.role !== "admin") {
    return { error: "No puedes quitarte a ti mismo el rol admin." };
  }

  const existingEmailUser = await findUserByEmail(input.email);

  if (existingEmailUser && existingEmailUser.id !== input.id) {
    return { error: "Ya existe otro usuario con ese email." };
  }

  if (input.coordinatorId === input.id) {
    return { error: "Un usuario no puede ser su propio coordinador." };
  }

  try {
    await updateUser(input.id, {
      canEditAllWfh: input.canEditAllWfh,
      coordinatorId: await resolveCoordinatorId(input.role, input.coordinatorId),
      email: input.email,
      hasWfh: input.hasWfh,
      name: input.name,
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
