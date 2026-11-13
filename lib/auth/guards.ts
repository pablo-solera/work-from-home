import { redirect } from "next/navigation";
import type { SessionUser } from "./session";
import { getUserById } from "@/lib/users/user-service";
import { resolveUserRole } from "@/lib/employees/org-service";
import { readSession } from "./session";
import { isSessionRevoked } from "./session-repository";
import { cache } from "react";

export async function requireAdmin() {
  const user = await requireAuthorizedUser();

  if (user.role !== "admin") {
    redirect("/calendar");
  }

  return user;
}

export async function requireCoordinator() {
  const user = await requireAuthorizedUser();

  if (user.role !== "coordinator") {
    redirect("/calendar");
  }

  return user;
}

/** Revalidates the signed role against the current Oracle organization. */
export async function requireAuthorizedUser(): Promise<SessionUser> {
  const user = await getAuthorizedUser();
  if (!user) redirect("/login");

  return user;
}

/** Revalidates the signed role without redirecting, for JSON route handlers. */
export const getAuthorizedUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  if (!session) return null;

  // The revocation check and the user lookup only depend on the signed token, so run them together.
  const [revoked, dbUser] = await Promise.all([isSessionRevoked(session.jti), getUserById(session.user.id)]);
  if (revoked || !dbUser) return null;

  return { ...session.user, role: await resolveUserRole(dbUser) };
});
