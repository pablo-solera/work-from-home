import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createWfhRequest: vi.fn(),
  requireAuthorizedUser: vi.fn(),
  sendAdditionalRequestCreatedEmail: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth/guards", () => ({ requireAuthorizedUser: mocks.requireAuthorizedUser }));
vi.mock("@/lib/requests/request-service", () => ({
  cancelWfhRequestDate: vi.fn(),
  createWfhRequest: mocks.createWfhRequest,
  decideWfhRequest: vi.fn(),
  markAdminSubstitutionAsRead: vi.fn(),
  markSubstitutionAsRead: vi.fn(),
}));
vi.mock("@/lib/requests/request-mail-service", () => ({ sendAdditionalRequestCreatedEmail: mocks.sendAdditionalRequestCreatedEmail }));

import { createWfhRequestAction } from "@/app/(dashboard)/requests/actions";

describe("createWfhRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthorizedUser.mockResolvedValue({ id: "employee-id", role: "employee" });
    mocks.createWfhRequest.mockResolvedValue({ ok: true, requestId: "request-id", message: "ok" });
  });

  it("passes removal through without sending an additional-request email", async () => {
    const formData = new FormData();
    formData.set("kind", "removal");
    formData.set("requestedDates", "2099-08-14,2099-08-24");

    await createWfhRequestAction({}, formData);

    expect(mocks.createWfhRequest).toHaveBeenCalledWith(expect.anything(), {
      kind: "removal",
      requestedDates: ["2099-08-14", "2099-08-24"],
      replacedDates: [],
      comment: null,
    });
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.sendAdditionalRequestCreatedEmail).not.toHaveBeenCalled();
  });

  it("sends additional-request email work only for additional requests", async () => {
    const formData = new FormData();
    formData.set("kind", "additional");
    formData.set("requestedDates", "2099-08-14;2099-08-24\n2099-08-25");
    formData.set("comment", "Motivo");

    await createWfhRequestAction({}, formData);

    expect(mocks.createWfhRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      kind: "additional",
      requestedDates: ["2099-08-14", "2099-08-24", "2099-08-25"],
    }));
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.sendAdditionalRequestCreatedEmail).not.toHaveBeenCalled();
  });

  it("falls back to additional for an unknown request kind", async () => {
    const formData = new FormData();
    formData.set("kind", "unknown");
    formData.set("requestedDates", "2099-08-14");

    await createWfhRequestAction({}, formData);

    expect(mocks.createWfhRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "additional" }));
  });
});
