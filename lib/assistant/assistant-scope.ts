import type { SessionUser } from "@/lib/auth/session";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findAllUsers } from "@/lib/users/user-repository";

/** Chat-only scope: admins and coordinators can query all visible staff. */
export async function getAssistantVisibleUsers(actor: SessionUser) {
  if (actor.role === "employee") return null;
  return filterVisibleStaff(await findAllUsers());
}
