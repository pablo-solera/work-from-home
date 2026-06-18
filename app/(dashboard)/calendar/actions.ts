"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { type ReplicateWorkFromHomeScope, replicateWorkFromHomeDays, setWorkFromHomeDayForActor } from "@/lib/calendar/calendar-service";

export async function toggleWorkFromHomeDayAction(formData: FormData) {
  const user = await requireUser();
  const date = String(formData.get("date") ?? "");
  const enabled = formData.get("enabled") === "true";
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");

  await setWorkFromHomeDayForActor(user, targetUserId, date, enabled);
  revalidatePath("/calendar");
  revalidatePath(`/calendar?year=${year}&month=${month}`);
  revalidatePath("/team");
  revalidatePath(`/team?year=${year}&month=${month}`);
  revalidatePath("/admin");
  revalidatePath(`/admin?year=${year}&month=${month}`);
  revalidatePath("/coverage");
  revalidatePath(`/coverage?year=${year}&month=${month}`);
}

export async function replicateWorkFromHomeDaysAction(formData: FormData) {
  const user = await requireUser();
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const scope = String(formData.get("scope") ?? "") as ReplicateWorkFromHomeScope;

  if (scope !== "next" && scope !== "untilYearEnd") {
    throw new Error("Invalid replication scope");
  }

  await replicateWorkFromHomeDays(user, { month, scope, targetUserId, year });
  revalidatePath("/calendar");
  revalidatePath("/team");
  revalidatePath("/admin");
  revalidatePath("/coverage");
}
