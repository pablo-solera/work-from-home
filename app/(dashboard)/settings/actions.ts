"use server";

import { revalidatePath } from "next/cache";
import { requireCoordinator } from "@/lib/auth/guards";
import { updateTeamVisibility } from "@/lib/users/user-service";
import { updateTeamVisibilitySchema } from "@/lib/users/user-validation";

export async function updateTeamVisibilityAction(teamWfhVisible: boolean) {
  const parsed = updateTeamVisibilitySchema.safeParse({ teamWfhVisible });
  if (!parsed.success) return { ok: false as const, error: "El valor de visibilidad no es válido." };

  const user = await requireCoordinator();

  const result = await updateTeamVisibility(user, parsed.data.teamWfhVisible);
  if (!result.ok) return result;
  revalidatePath("/settings");
  revalidatePath("/team");
  return result;
}
