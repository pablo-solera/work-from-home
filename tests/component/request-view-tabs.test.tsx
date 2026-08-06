// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequestViewTabs } from "@/components/requests/request-view-tabs";

describe("RequestViewTabs", () => {
  it("marks the active tab and shows its counter", () => {
    render(<RequestViewTabs ariaLabel="Ámbito de solicitudes" tabs={[
      { active: true, count: 6, href: "/requests", label: "Solicitudes del equipo" },
      { active: false, href: "/requests?view=own", label: "Mis solicitudes" },
    ]} />);

    expect(screen.getByRole("link", { name: /Solicitudes del equipo6/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Mis solicitudes" })).not.toHaveAttribute("aria-current");
  });

  it("does not render a counter for tabs without one", () => {
    render(<RequestViewTabs ariaLabel="Ámbito de solicitudes" tabs={[{ active: true, href: "/requests", label: "Mis solicitudes" }]} />);

    expect(screen.getByRole("link", { name: "Mis solicitudes" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
