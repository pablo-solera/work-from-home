import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  findEmployeesByIds: vi.fn(),
  findRequesterById: vi.fn(),
  findRequestByIdWithDates: vi.fn(),
  getOrganizationSnapshot: vi.fn(),
  resolveUserIdentities: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock("@/lib/employees/employee-repository", () => ({ findEmployeesByIds: mocks.findEmployeesByIds }));
vi.mock("@/lib/employees/identity-service", () => ({ resolveUserIdentities: mocks.resolveUserIdentities }));
vi.mock("@/lib/employees/org-service", () => ({ getOrganizationSnapshot: mocks.getOrganizationSnapshot }));
vi.mock("@/lib/requests/request-repository", () => ({
  findRequesterById: mocks.findRequesterById,
  findRequestByIdWithDates: mocks.findRequestByIdWithDates,
}));

import { sendAdditionalRequestCreatedEmail, sendAdditionalRequestDecisionEmail } from "@/lib/requests/request-mail-service";

const requester = {
  id: "requester-id",
  oracleEmpId: 100,
  fallbackEmail: null,
  fallbackName: null,
};

const request = {
  id: "request-id",
  requesterId: requester.id,
  kind: "additional",
  requesterComment: "Necesito el día por una cita.",
  decisionComment: "Aprobada.",
  dates: [{ requestedDate: "2099-01-05", cancelledAt: null }],
};

describe("request email notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MAIL_ENABLED", "true");
    vi.stubEnv("SMTP_HOST", "10.33.144.238");
    vi.stubEnv("SMTP_PORT", "25");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_FROM", "teletrabajo@audatex.es");
    vi.stubEnv("APP_BASE_URL", "https://wfh.audatex.es");
    globalThis.__wfhMailer = undefined;
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.findRequestByIdWithDates.mockResolvedValue(request);
    mocks.findRequesterById.mockResolvedValue(requester);
    mocks.resolveUserIdentities.mockResolvedValue(new Map([[requester.id, { name: "Pablo Avila", email: "pablo.avila@solera.com", wdNumber: null }]]));
    mocks.getOrganizationSnapshot.mockResolvedValue({ adminEmpIds: new Set([200, 201]) });
    mocks.findEmployeesByIds.mockResolvedValue(new Map([
      [200, { email: "admin.one@audatex.es" }],
      [201, { email: "admin.two@audatex.es" }],
    ]));
    mocks.sendMail.mockResolvedValue({ messageId: "test-message" });
  });

  it("sends a new additional request to all TIMERTASK administrators", async () => {
    await sendAdditionalRequestCreatedEmail(request.id);

    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "teletrabajo@audatex.es",
      to: ["admin.one@audatex.es", "admin.two@audatex.es"],
      subject: "Nueva solicitud de día adicional - Pablo Avila",
    }));
  });

  it("sends the decision to the requester", async () => {
    await sendAdditionalRequestDecisionEmail(request.id, "accepted");

    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "pablo.avila@solera.com",
      subject: "Solicitud de día adicional aprobada",
    }));
  });

  it("does not throw when SMTP fails", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP unavailable"));

    await expect(sendAdditionalRequestDecisionEmail(request.id, "rejected")).resolves.toBeUndefined();
  });
});
