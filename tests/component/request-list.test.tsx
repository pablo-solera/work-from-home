// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminRequestList, RequesterRequestList } from "@/components/requests/request-list";

vi.mock("@/app/(dashboard)/requests/actions", () => ({
  cancelWfhRequestDateAction: vi.fn(),
  decideWfhRequestAction: vi.fn(),
  markSubstitutionAsReadAction: vi.fn(),
}));

vi.mock("@/app/(dashboard)/admin/requests/actions", () => ({
  decideAdminWfhRequestAction: vi.fn(),
  markAdminSubstitutionAsReadAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const initialPage = {
  nextCursor: null,
  requests: [{
    coordinatorNotifiedAt: null,
    coordinatorAcknowledgedAt: null,
    dates: [{ cancelledAt: null, id: "date-1", replacedDate: null, requestedDate: "2099-01-10" }],
    decisionComment: null,
    id: "request-1",
    kind: "additional" as const,
    requesterComment: "Motivo",
    status: "pending" as const,
  }],
};

const filters = { date: "all" as const, status: "all" as const };

describe("request cancellation visibility", () => {
  it("shows cancellation only in the requester's list", () => {
    const { unmount } = render(<RequesterRequestList filters={filters} initialPage={initialPage} />);
    expect(screen.getByRole("button", { name: "Cancelar día" })).toBeInTheDocument();
    unmount();

    render(<AdminRequestList filters={filters} initialPage={initialPage} />);
    expect(screen.queryByRole("button", { name: "Cancelar día" })).not.toBeInTheDocument();
  });
});
