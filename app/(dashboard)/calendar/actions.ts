"use server";

import { revalidatePath } from "next/cache";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { replicateWorkFromHomeDays, setWorkFromHomeDayForActor } from "@/lib/calendar/calendar-service";
import { replicateWorkFromHomeDaysSchema, toggleWorkFromHomeDaySchema } from "@/lib/calendar/calendar-validation";
import { formDataObject } from "@/lib/requests/request-validation";
import { revalidateWfhViews } from "@/lib/revalidation";

export async function toggleWorkFromHomeDayAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const parsed = toggleWorkFromHomeDaySchema.safeParse(formDataObject(formData, ["date", "enabled", "targetUserId", "sourcePath"]));
  if (!parsed.success) return { ok: false as const, error: "Los datos del día no son válidos." };
  const { date, enabled, targetUserId, sourcePath } = parsed.data;

  const result = await setWorkFromHomeDayForActor(user, targetUserId, date, enabled);
  if (!result.ok) return result;
  revalidatePath(sourcePath);
  return { ok: true as const };
}

export async function replicateWorkFromHomeDaysAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const parsed = replicateWorkFromHomeDaysSchema.safeParse(formDataObject(formData, ["targetUserId", "year", "month", "scope"]));
  if (!parsed.success) return { ok: false as const, error: "Los datos de replicación no son válidos." };
  const { targetUserId, year, month, scope } = parsed.data;

  const result = await replicateWorkFromHomeDays(user, { month, scope, targetUserId, year });
  if (!result.ok) return result;
  revalidateWfhViews();
  return { ok: true as const };
}
