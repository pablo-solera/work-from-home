import type { SessionUser } from "@/lib/auth/session";
import { findEmployeeByCoordinatorId } from "@/lib/employees/org-service";
import { findUserById } from "@/lib/users/user-repository";
import { getMadridTodayDateKey } from "./dates";

export function getMinimumEditableDate(role: SessionUser["role"]) {
  return role === "admin" ? undefined : getMadridTodayDateKey();
}

export async function assertCanEditWorkFromHomeDays(actor: SessionUser, targetUserId: string) {
  if (actor.role === "admin") return;
  if (actor.role === "employee") throw new Error("Employees cannot update work-from-home days");

  const actorUser = await findUserById(actor.id);
  if (actorUser?.canEditAllWfh) return;

  if (actor.role === "coordinator") {
    if (targetUserId === actor.id) return;
    const employee = await findEmployeeByCoordinatorId(targetUserId, actor.id, actorUser);
    if (!employee) throw new Error("Employee is not assigned to this coordinator");
  }
}
