"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LdapUnavailableError } from "@/lib/auth/ldap";
import { setSessionCookie } from "@/lib/auth/session";
import { authenticateUser } from "@/lib/users/user-service";
import { loginSchema } from "@/lib/users/user-validation";
import { checkRateLimit } from "@/lib/rate-limit";

export type LoginFormState = {
  error?: string;
};

export async function loginAction(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const startedAt = Date.now();
  const finish = async (result: LoginFormState): Promise<LoginFormState> => {
    const remaining = 700 - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    return result;
  };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const requestHeaders = await headers();
  const trustedProxyIp = process.env.TRUST_PROXY_IP_HEADERS === "true" ? requestHeaders.get("x-real-ip") : null;
  const emailKey = parsed.success ? parsed.data.email.toLowerCase() : String(formData.get("email") ?? "invalid").toLowerCase().slice(0, 254);
  const ipLimit = trustedProxyIp ? checkRateLimit(`login:ip:${trustedProxyIp}`, 30, 15 * 60_000) : { allowed: true, resetAt: Date.now() };
  const emailLimit = checkRateLimit(`login:email:${emailKey}`, 10, 15 * 60_000);
  if (!ipLimit.allowed || !emailLimit.allowed) return finish({ error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." });

  if (!parsed.success) {
    return finish({ error: "Credenciales incorrectas." });
  }

  let user;

  try {
    user = await authenticateUser(parsed.data.email, parsed.data.password);
  } catch (error) {
    if (error instanceof LdapUnavailableError) {
      return finish({ error: "Credenciales incorrectas." });
    }

    throw error;
  }

  if (!user) {
    return finish({ error: "Credenciales incorrectas." });
  }

  await setSessionCookie(user);
  redirect(user.role === "admin" ? "/admin" : "/calendar");
}
