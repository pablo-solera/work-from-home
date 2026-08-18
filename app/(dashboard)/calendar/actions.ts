"use server";

import { revalidatePath } from "next/cache";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { replicateWorkFromHomeDays, setWorkFromHomeDayForActor } from "@/lib/calendar/calendar-service";
import { replicateWorkFromHomeDaysSchema, toggleWorkFromHomeDaySchema } from "@/lib/calendar/calendar-validation";

export async function toggleWorkFromHomeDayAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const parsed = toggleWorkFromHomeDaySchema.safeParse(Object.fromEntries(["date", "enabled", "targetUserId", "sourcePath"].map((field) => [field, formData.get(field)])));
  if (!parsed.success) return { ok: false as const, error: "Los datos del día no son válidos." };
  const { date, enabled, targetUserId, sourcePath } = parsed.data;

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
  const parsed = replicateWorkFromHomeDaysSchema.safeParse(Object.fromEntries(["targetUserId", "year", "month", "scope"].map((field) => [field, formData.get(field)])));
  if (!parsed.success) return { ok: false as const, error: "Los datos de replicación no son válidos." };
  const { targetUserId, year, month, scope } = parsed.data;

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
