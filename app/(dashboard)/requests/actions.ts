"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { createWfhRequest, decideWfhRequest, markSubstitutionAsRead, type RequestFormState } from "@/lib/requests/request-service";

function parseDates(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((date) => date.trim())
    .filter(Boolean);
}

export async function createWfhRequestAction(_state: RequestFormState, formData: FormData) {
  const user = await requireUser();
  const result = await createWfhRequest(user, {
    kind: formData.get("kind") === "substitution" ? "substitution" : "additional",
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
  }

  return result;
}

export async function decideWfhRequestAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "coordinator") {
    throw new Error("No tienes permiso para gestionar solicitudes.");
  }

  const status = formData.get("status");
  if (status !== "accepted" && status !== "rejected") {
    throw new Error("Estado de solicitud no válido.");
  }

  const result = await decideWfhRequest(user, String(formData.get("id") ?? ""), status, String(formData.get("comment") ?? "").trim() || null);

  if (result.ok) {
    revalidatePath("/requests");
    revalidatePath("/calendar");
    revalidatePath("/team");
    revalidatePath("/admin");
    revalidatePath("/coverage");
    revalidatePath("/(dashboard)", "layout");
    return;
  }

  throw new Error(result.error ?? "No se pudo resolver la solicitud.");
}

export async function markSubstitutionAsReadAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "coordinator") {
    throw new Error("No tienes permiso para marcar notificaciones.");
  }

  await markSubstitutionAsRead(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/requests");
  revalidatePath("/(dashboard)", "layout");
}
