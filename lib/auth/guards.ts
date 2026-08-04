import { redirect } from "next/navigation";
import type { SessionUser } from "./session";
import { findUserById } from "@/lib/users/user-repository";
import { resolveUserRole } from "@/lib/employees/org-service";
import { getCurrentUser } from "./session";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

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
  const user = await requireUser();
  const dbUser = await findUserById(user.id);

  if (!dbUser) redirect("/login");

  return { ...user, role: await resolveUserRole(dbUser) };
}
