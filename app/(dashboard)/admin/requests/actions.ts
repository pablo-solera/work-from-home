"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { decideWfhRequest } from "@/lib/requests/request-service";

export async function decideAdminWfhRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const status = formData.get("status");

  if (status !== "accepted" && status !== "rejected") {
    throw new Error("Estado de solicitud no válido.");
  }

  const result = await decideWfhRequest(admin, String(formData.get("id") ?? ""), status, String(formData.get("comment") ?? "").trim() || null);

  if (!result.ok) {
    throw new Error(result.error ?? "No se pudo resolver la solicitud.");
  }

  revalidatePath("/admin/requests");
  revalidatePath("/requests");
  revalidatePath("/calendar");
  revalidatePath("/team");
  revalidatePath("/admin");
  revalidatePath("/coverage");
  revalidatePath("/(dashboard)", "layout");
}
