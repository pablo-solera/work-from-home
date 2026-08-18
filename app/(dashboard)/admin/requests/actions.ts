"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { decideWfhRequest } from "@/lib/requests/request-service";
import { sendAdditionalRequestDecisionEmail } from "@/lib/requests/request-mail-service";
import { decideWfhRequestSchema, formDataObject } from "@/lib/requests/request-validation";

export async function decideAdminWfhRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = decideWfhRequestSchema.safeParse(formDataObject(formData, ["id", "status", "comment"]));
  if (!parsed.success) return { ok: false as const, error: "Los datos de la decisión no son válidos." };
  const result = await decideWfhRequest(admin, parsed.data.id, parsed.data.status, parsed.data.comment);

  if (!result.ok) {
    return { ok: false as const, error: result.error ?? "No se pudo resolver la solicitud." };
  }

  revalidatePath("/admin/requests");
  revalidatePath("/requests");
  revalidatePath("/calendar");
  revalidatePath("/team");
  revalidatePath("/admin");
  revalidatePath("/coverage");
  revalidatePath("/(dashboard)", "layout");
  after(() => sendAdditionalRequestDecisionEmail(parsed.data.id, parsed.data.status));
  return { ok: true as const };
}
