import { redirect } from "next/navigation";
import type { SessionUser } from "./session";
import { getUserById } from "@/lib/users/user-service";
import { resolveUserRole } from "@/lib/employees/org-service";
import { getCurrentUser } from "./session";

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
export async function getAuthorizedUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const dbUser = await getUserById(user.id);

  if (!dbUser) return null;

  return { ...user, role: await resolveUserRole(dbUser) };
}
