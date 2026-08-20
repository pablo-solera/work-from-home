import { revalidatePath } from "next/cache";

export function revalidateWfhViews() {
  revalidatePath("/requests");
  revalidatePath("/calendar");
  revalidatePath("/team");
  revalidatePath("/admin");
  revalidatePath("/coverage");
  revalidatePath("/(dashboard)", "layout");
}
