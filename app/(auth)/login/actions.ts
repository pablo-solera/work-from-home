"use server";

import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/auth/session";
import { authenticateUser } from "@/lib/users/user-service";
import { loginSchema } from "@/lib/users/user-validation";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const user = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!user) {
    redirect("/login?error=invalid");
  }

  await setSessionCookie(user);
  redirect(user.role === "admin" ? "/admin" : "/calendar");
}
