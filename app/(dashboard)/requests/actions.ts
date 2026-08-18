"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { cancelWfhRequestDate, createWfhRequest, decideWfhRequest, markAdminSubstitutionAsRead, markSubstitutionAsRead, type RequestFormState } from "@/lib/requests/request-service";
import { sendAdditionalRequestCreatedEmail } from "@/lib/requests/request-mail-service";
import { cancelWfhRequestDateSchema, createWfhRequestSchema, decideWfhRequestSchema, formDataObject, requestIdSchema } from "@/lib/requests/request-validation";

export async function createWfhRequestAction(_state: RequestFormState, formData: FormData) {
  const user = await requireAuthorizedUser();
  const parsed = createWfhRequestSchema.safeParse(formDataObject(formData, ["kind", "requestedDates", "replacedDates", "comment"]));
  if (!parsed.success) return { error: "Los datos de la solicitud no son válidos." };
  const { kind } = parsed.data;
  const result = await createWfhRequest(user, parsed.data);

  if (result.ok) {
    revalidatePath("/requests");
    revalidatePath("/calendar");
    revalidatePath("/team");
    revalidatePath("/admin");
    revalidatePath("/coverage");
    revalidatePath("/(dashboard)", "layout");
    if (kind === "additional" && result.requestId) {
      after(() => sendAdditionalRequestCreatedEmail(result.requestId!));
    }
  }

  return result;
}

export async function decideWfhRequestAction(formData: FormData) {
  const user = await requireAuthorizedUser();

  if (user.role !== "coordinator") return { ok: false as const, error: "No tienes permiso para gestionar solicitudes." };

  const parsed = decideWfhRequestSchema.safeParse(formDataObject(formData, ["id", "status", "comment"]));
  if (!parsed.success) return { ok: false as const, error: "Los datos de la decisión no son válidos." };
  const result = await decideWfhRequest(user, parsed.data.id, parsed.data.status, parsed.data.comment);

  if (result.ok) {
    revalidatePath("/requests");
    revalidatePath("/calendar");
    revalidatePath("/team");
    revalidatePath("/admin");
    revalidatePath("/coverage");
    revalidatePath("/(dashboard)", "layout");
    return { ok: true as const };
  }

  return { ok: false as const, error: result.error ?? "No se pudo resolver la solicitud." };
}

export async function markSubstitutionAsReadAction(formData: FormData) {
  const user = await requireAuthorizedUser();

  if (user.role !== "coordinator") {
    return { ok: false as const, error: "No tienes permiso para marcar notificaciones." };
  }

  const parsed = requestIdSchema.safeParse(formDataObject(formData, ["id"]));
  if (!parsed.success) return { ok: false as const, error: "La notificación no es válida." };
  await markSubstitutionAsRead(user.id, parsed.data.id);
  revalidatePath("/requests");
  revalidatePath("/(dashboard)", "layout");
  return { ok: true as const };
}

export async function markAdminSubstitutionAsReadAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  if (user.role !== "admin") return { ok: false as const, error: "No tienes permiso para marcar notificaciones." };
  const parsed = requestIdSchema.safeParse(formDataObject(formData, ["id"]));
  if (!parsed.success) return { ok: false as const, error: "La notificación no es válida." };
  await markAdminSubstitutionAsRead(parsed.data.id);
  revalidatePath("/admin/requests");
  revalidatePath("/(dashboard)", "layout");
  return { ok: true as const };
}

export async function cancelWfhRequestDateAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const parsed = cancelWfhRequestDateSchema.safeParse(formDataObject(formData, ["requestId", "dateId"]));
  if (!parsed.success) return { ok: false as const, error: "Los datos de la fecha no son válidos." };
  const result = await cancelWfhRequestDate(user, parsed.data.requestId, parsed.data.dateId);

  if (!result.ok) {
    return { ok: false as const, error: result.error ?? "No se pudo cancelar la fecha." };
  }

  revalidatePath("/requests");
  revalidatePath("/calendar");
  revalidatePath("/team");
  revalidatePath("/admin");
  revalidatePath("/coverage");
  revalidatePath("/(dashboard)", "layout");
  return result;
}
