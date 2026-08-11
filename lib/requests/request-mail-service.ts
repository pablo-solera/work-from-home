import { findEmployeesByIds } from "@/lib/employees/employee-repository";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { getOrganizationSnapshot } from "@/lib/employees/org-service";
import { sendMail } from "@/lib/mail/mailer";
import { findRequesterById, findRequestByIdWithDates } from "./request-repository";

type DecisionStatus = "accepted" | "rejected";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function applicationUrl(path: string) {
  const baseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  return baseUrl ? `${baseUrl}${path}` : null;
}

function datesText(dates: string[]) {
  return dates.join(", ");
}

function datesHtml(dates: string[]) {
  return dates.map((date) => `<li>${escapeHtml(date)}</li>`).join("");
}

function logMailError(event: string, error: unknown) {
  console.error(`Failed to send ${event} email:`, error);
}

export async function sendAdditionalRequestCreatedEmail(requestId: string) {
  try {
    const request = await findRequestByIdWithDates(requestId);
    if (!request || request.kind !== "additional") return;

    const requester = await findRequesterById(request.requesterId);
    if (!requester) return;

    const requesterIdentity = (await resolveUserIdentities([requester])).get(requester.id);
    const requesterName = requesterIdentity?.name ?? requester.fallbackName ?? "Empleado";
    const dates = request.dates.filter((date) => !date.cancelledAt).map((date) => date.requestedDate);
    const organization = await getOrganizationSnapshot();
    const administrators = await findEmployeesByIds([...organization.adminEmpIds]);
    const recipients = [...administrators.values()].map((employee) => employee.email).filter(Boolean);
    const url = applicationUrl("/admin/requests");
    const safeName = escapeHtml(requesterName);
    const safeComment = escapeHtml(request.requesterComment ?? "Sin comentario");

    if (recipients.length === 0 || dates.length === 0) return;

    await sendMail({
      to: recipients,
      subject: `Nueva solicitud de día adicional - ${requesterName}`,
      text: [
        `Nueva solicitud de día adicional de ${requesterName}.`,
        `Fechas: ${datesText(dates)}`,
        `Motivo: ${request.requesterComment ?? "Sin comentario"}`,
        url ? `Gestionar solicitud: ${url}` : null,
      ].filter(Boolean).join("\n"),
      html: `<p>Nueva solicitud de día adicional de <strong>${safeName}</strong>.</p><p><strong>Fechas:</strong></p><ul>${datesHtml(dates)}</ul><p><strong>Motivo:</strong> ${safeComment}</p>${url ? `<p><a href="${escapeHtml(url)}">Gestionar solicitud</a></p>` : ""}`,
    });
  } catch (error) {
    logMailError("new additional request", error);
  }
}

export async function sendAdditionalRequestDecisionEmail(requestId: string, status: DecisionStatus) {
  try {
    const request = await findRequestByIdWithDates(requestId);
    if (!request || request.kind !== "additional") return;

    const requester = await findRequesterById(request.requesterId);
    if (!requester) return;

    const requesterIdentity = (await resolveUserIdentities([requester])).get(requester.id);
    const recipient = requesterIdentity?.email ?? requester.fallbackEmail;
    const requesterName = requesterIdentity?.name ?? requester.fallbackName ?? "Empleado";
    const dates = request.dates.filter((date) => !date.cancelledAt).map((date) => date.requestedDate);
    const accepted = status === "accepted";
    const outcome = accepted ? "aprobada" : "rechazada";
    const url = applicationUrl("/requests");
    const safeName = escapeHtml(requesterName);
    const safeComment = escapeHtml(request.decisionComment ?? "Sin comentario");

    if (!recipient || dates.length === 0) return;

    await sendMail({
      to: recipient,
      subject: `Solicitud de día adicional ${outcome}`,
      text: [
        `Hola ${requesterName},`,
        `Tu solicitud de día adicional ha sido ${outcome}.`,
        `Fechas: ${datesText(dates)}`,
        `Comentario: ${request.decisionComment ?? "Sin comentario"}`,
        url ? `Ver solicitudes: ${url}` : null,
      ].filter(Boolean).join("\n"),
      html: `<p>Hola ${safeName},</p><p>Tu solicitud de día adicional ha sido <strong>${outcome}</strong>.</p><p><strong>Fechas:</strong></p><ul>${datesHtml(dates)}</ul><p><strong>Comentario:</strong> ${safeComment}</p>${url ? `<p><a href="${escapeHtml(url)}">Ver solicitudes</a></p>` : ""}`,
    });
  } catch (error) {
    logMailError("additional request decision", error);
  }
}
