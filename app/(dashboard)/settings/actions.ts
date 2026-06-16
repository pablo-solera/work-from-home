"use server";

import { revalidatePath } from "next/cache";
import { requireCoordinator } from "@/lib/auth/guards";
import { updateTeamWfhVisibility } from "@/lib/users/user-repository";

export async function updateTeamVisibilityAction(teamWfhVisible: boolean) {
  const user = await requireCoordinator();

  await updateTeamWfhVisibility(user.id, teamWfhVisible);
  revalidatePath("/settings");
  revalidatePath("/team");
}
