"use server";

import { redirect } from "next/navigation";
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

  const user = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!user) {
    return { error: "Credenciales incorrectas." };
  }

  await setSessionCookie(user);
  redirect(user.role === "admin" ? "/admin" : "/calendar");
}
