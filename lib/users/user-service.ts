import type { UserRole } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import { generateTemporaryPassword } from "./password-generator";
import { createUsers, findUserByEmail, findUsersByEmails } from "./user-repository";
import { isValidEmail, parseBulkEmails } from "./user-validation";

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

export async function createUsersFromEmails(input: string, role: UserRole): Promise<BulkUserCreationResult> {
  const emails = parseBulkEmails(input);
  const invalid = emails.filter((email) => !isValidEmail(email));
  const validEmails = emails.filter((email) => isValidEmail(email));
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
      };
    })
  );

  const createdUsers = await createUsers(
    generatedUsers.map(({ name, email, passwordHash, role }) => ({ name, email, passwordHash, role }))
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
