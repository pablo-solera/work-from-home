// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestFilters } from "@/components/requests/request-filters";
import { GeneratedAvatar } from "@/components/common/generated-avatar";

const push = vi.fn();
let pathname = "/admin/requests";
let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe("RequestFilters", () => {
  beforeEach(() => {
    push.mockReset();
    pathname = "/admin/requests";
    params = new URLSearchParams();
  });

  it("clears all admin filters back to pending", () => {
    render(<RequestFilters date="month" status="accepted" defaultStatus="pending" />);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(push).toHaveBeenCalledWith("/admin/requests");
  });

  it("preserves the active request view when clearing filters", () => {
    params = new URLSearchParams("date=month&status=accepted&view=team");
    render(<RequestFilters date="month" status="accepted" />);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(push).toHaveBeenCalledWith("/admin/requests?view=team");
  });

  it("keeps an explicit admin all-status filter in the URL", () => {
    render(<RequestFilters date="all" status="pending" defaultStatus="pending" />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "all" } });
    expect(push).toHaveBeenCalledWith("/admin/requests?status=all");
  });

  it("removes all-status for the employee default", () => {
    pathname = "/requests";
    params = new URLSearchParams("status=accepted");
    render(<RequestFilters date="all" status="accepted" />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "all" } });
    expect(push).toHaveBeenCalledWith("/requests");
  });

  it("renders generated avatars", () => {
    render(<GeneratedAvatar name="Ana García" />);
    expect(screen.getByText("AG")).toBeInTheDocument();
  });
});
