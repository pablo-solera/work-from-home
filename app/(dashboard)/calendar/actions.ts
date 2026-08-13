"use server";

import { revalidatePath } from "next/cache";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { type ReplicateWorkFromHomeScope, replicateWorkFromHomeDays, setWorkFromHomeDayForActor } from "@/lib/calendar/calendar-service";

export async function toggleWorkFromHomeDayAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const date = String(formData.get("date") ?? "");
  const enabled = formData.get("enabled") === "true";
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const sourcePath = String(formData.get("sourcePath") ?? "");

  if (!["/calendar", "/team", "/admin", "/coverage"].includes(sourcePath)) {
    throw new Error("Invalid source path");
  }

  try {
    await setWorkFromHomeDayForActor(user, targetUserId, date, enabled);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo actualizar el día." };
  }
  revalidatePath(sourcePath);
  return { ok: true as const };
}

export async function replicateWorkFromHomeDaysAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const scope = String(formData.get("scope") ?? "") as ReplicateWorkFromHomeScope;

  if (scope !== "next" && scope !== "untilYearEnd") {
    throw new Error("Invalid replication scope");
  }

  try {
    await replicateWorkFromHomeDays(user, { month, scope, targetUserId, year });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo replicar el patrón." };
  }
  revalidatePath("/calendar");
  revalidatePath("/team");
  revalidatePath("/admin");
  revalidatePath("/coverage");
  return { ok: true as const };
}
