"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { decideWfhRequestForActor } from "@/lib/requests/request-decision-service";
import { sendAdditionalRequestDecisionEmail } from "@/lib/requests/request-mail-service";
import { decideWfhRequestSchema, formDataObject } from "@/lib/requests/request-validation";
import { revalidateWfhViews } from "@/lib/revalidation";

export async function decideAdminWfhRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = decideWfhRequestSchema.safeParse(formDataObject(formData, ["id", "status", "comment"]));
  if (!parsed.success) return { ok: false as const, error: "Los datos de la decisión no son válidos." };
  const result = await decideWfhRequestForActor(admin, parsed.data.id, parsed.data.status, parsed.data.comment);

  if (!result.ok) {
    return { ok: false as const, error: result.error ?? "No se pudo resolver la solicitud." };
  }

  revalidatePath("/admin/requests");
  revalidateWfhViews();
  after(() => sendAdditionalRequestDecisionEmail(parsed.data.id, parsed.data.status));
  return { ok: true as const };
}
