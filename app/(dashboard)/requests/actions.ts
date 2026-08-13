"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { cancelWfhRequestDate, createWfhRequest, decideWfhRequest, markAdminSubstitutionAsRead, markSubstitutionAsRead, type RequestFormState } from "@/lib/requests/request-service";
import { sendAdditionalRequestCreatedEmail } from "@/lib/requests/request-mail-service";

function parseDates(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((date) => date.trim())
    .filter(Boolean);
}

export async function createWfhRequestAction(_state: RequestFormState, formData: FormData) {
  const user = await requireAuthorizedUser();
  const submittedKind = String(formData.get("kind") ?? "");
  const kind = submittedKind === "substitution" || submittedKind === "removal" ? submittedKind : "additional";
  const result = await createWfhRequest(user, {
    kind,
    requestedDates: parseDates(formData.get("requestedDates")),
    replacedDates: parseDates(formData.get("replacedDates")),
    comment: String(formData.get("comment") ?? "").trim() || null,
  });

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

  const status = formData.get("status");
  if (status !== "accepted" && status !== "rejected") {
    return { ok: false as const, error: "Estado de solicitud no válido." };
  }

  const result = await decideWfhRequest(user, String(formData.get("id") ?? ""), status, String(formData.get("comment") ?? "").trim() || null);

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

  await markSubstitutionAsRead(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/requests");
  revalidatePath("/(dashboard)", "layout");
  return { ok: true as const };
}

export async function markAdminSubstitutionAsReadAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  if (user.role !== "admin") return { ok: false as const, error: "No tienes permiso para marcar notificaciones." };
  await markAdminSubstitutionAsRead(String(formData.get("id") ?? ""));
  revalidatePath("/admin/requests");
  revalidatePath("/(dashboard)", "layout");
  return { ok: true as const };
}

export async function cancelWfhRequestDateAction(formData: FormData) {
  const user = await requireAuthorizedUser();
  const result = await cancelWfhRequestDate(user, String(formData.get("requestId") ?? ""), String(formData.get("dateId") ?? ""));

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
