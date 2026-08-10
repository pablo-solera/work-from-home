// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CancelRequestDateButton } from "@/components/requests/cancel-request-date-button";
import { MarkAdminSubstitutionReadButton } from "@/components/requests/mark-admin-substitution-read-button";
import { MarkSubstitutionReadButton } from "@/components/requests/mark-substitution-read-button";
import { RequestDecisionForm } from "@/components/requests/request-decision-form";

const actions = vi.hoisted(() => ({
  cancel: vi.fn(),
  decide: vi.fn(),
  decideAdmin: vi.fn(),
  mark: vi.fn(),
  markAdmin: vi.fn(),
}));
const refresh = vi.fn();

vi.mock("@/app/(dashboard)/requests/actions", () => ({
  cancelWfhRequestDateAction: actions.cancel,
  decideWfhRequestAction: actions.decide,
  markAdminSubstitutionAsReadAction: actions.markAdmin,
  markSubstitutionAsReadAction: actions.mark,
}));

vi.mock("@/app/(dashboard)/admin/requests/actions", () => ({
  decideAdminWfhRequestAction: actions.decideAdmin,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("request action components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.cancel.mockResolvedValue({ ok: true });
    actions.decide.mockResolvedValue({ ok: true });
    actions.decideAdmin.mockResolvedValue({ ok: true });
    actions.mark.mockResolvedValue({ ok: true });
    actions.markAdmin.mockResolvedValue({ ok: true });
  });

  it("confirms and cancels a request date, or backs out", () => {
    render(<CancelRequestDateButton dateId="date-1" dateLabel="10-01-2099" requestId="request-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar día" }));
    expect(screen.getByText("¿Cancelar 10-01-2099?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByRole("button", { name: "Cancelar día" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar día" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    expect(actions.cancel).toHaveBeenCalled();
  });

  it("shows cancellation errors", async () => {
    actions.cancel.mockRejectedValueOnce(new Error("No se puede cancelar"));
    render(<CancelRequestDateButton dateId="date-1" dateLabel="10-01-2099" requestId="request-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar día" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede cancelar");
  });

  it("submits coordinator and admin decisions", async () => {
    const { rerender } = render(<RequestDecisionForm requestId="request-1" />);
    fireEvent.change(screen.getByLabelText("Comentario opcional"), { target: { value: "De acuerdo" } });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(actions.decide).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();

    rerender(<RequestDecisionForm adminView requestId="request-2" />);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(actions.decideAdmin).toHaveBeenCalled());
  });

  it("shows decision errors", async () => {
    actions.decide.mockRejectedValueOnce(new Error("Decisión no disponible"));
    render(<RequestDecisionForm requestId="request-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(await screen.findByText("Decisión no disponible")).toBeInTheDocument();
  });

  it("marks coordinator and admin substitutions as read", async () => {
    const { rerender } = render(<MarkSubstitutionReadButton requestId="request-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar como leída" }));
    await waitFor(() => expect(actions.mark).toHaveBeenCalled());

    rerender(<MarkAdminSubstitutionReadButton requestId="request-2" />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar como leída" }));
    await waitFor(() => expect(actions.markAdmin).toHaveBeenCalled());
  });

  it("shows coordinator read errors", async () => {
    actions.mark.mockRejectedValueOnce(new Error("No se pudo marcar"));
    render(<MarkSubstitutionReadButton requestId="request-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar como leída" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo marcar");
  });
});
