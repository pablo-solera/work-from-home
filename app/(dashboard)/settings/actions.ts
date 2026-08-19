"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoordinator } from "@/lib/auth/guards";
import { updateTeamWfhVisibility } from "@/lib/users/user-repository";

const updateTeamVisibilitySchema = z.object({ teamWfhVisible: z.boolean() });

export async function updateTeamVisibilityAction(teamWfhVisible: boolean) {
  const parsed = updateTeamVisibilitySchema.safeParse({ teamWfhVisible });
  if (!parsed.success) throw new Error("El valor de visibilidad no es válido.");

  const user = await requireCoordinator();

  await updateTeamWfhVisibility(user.id, parsed.data.teamWfhVisible);
  revalidatePath("/settings");
  revalidatePath("/team");
}
