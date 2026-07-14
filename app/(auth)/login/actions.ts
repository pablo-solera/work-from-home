"use server";

import { redirect } from "next/navigation";
import { LdapUnavailableError } from "@/lib/auth/ldap";
import { setSessionCookie } from "@/lib/auth/session";
import { authenticateUser } from "@/lib/users/user-service";
import { loginSchema } from "@/lib/users/user-validation";

export type LoginFormState = {
  error?: string;
};

export async function loginAction(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Credenciales incorrectas." };
  }

  let user;

  try {
    user = await authenticateUser(parsed.data.email, parsed.data.password);
  } catch (error) {
    if (error instanceof LdapUnavailableError) {
      return { error: "Servicio de autenticación no disponible. Inténtalo de nuevo en unos minutos." };
    }

    throw error;
  }

  if (!user) {
    return { error: "Credenciales incorrectas." };
  }

  await setSessionCookie(user);
  redirect(user.role === "admin" ? "/admin" : "/calendar");
}
