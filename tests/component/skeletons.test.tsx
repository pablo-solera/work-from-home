// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequestCardSkeleton, RequestFiltersSkeleton, RequestListSkeleton, RequestViewTabsSkeleton, RequestsPageSkeleton } from "@/components/common/request-skeleton";
import { Skeleton, SkeletonStatus } from "@/components/common/skeleton";

describe("request skeletons", () => {
  it("renders the shared skeleton primitives", () => {
    const { container } = render(<><Skeleton className="h-4" /><SkeletonStatus label="Cargando datos" /></>);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Cargando datos" })).toBeInTheDocument();
  });

  it("renders request cards and lists with their variants", () => {
    const { container } = render(<><RequestCardSkeleton coordinatorView /><RequestListSkeleton count={2} coordinatorView label="Cargando lista" /><RequestFiltersSkeleton /><RequestViewTabsSkeleton /></>);

    expect(screen.getByRole("status", { name: "Cargando lista" })).toBeInTheDocument();
    expect(container.querySelectorAll("[aria-hidden=\"true\"]").length).toBeGreaterThan(2);
  });

  it("renders the page skeleton with optional tabs and filters", () => {
    render(<RequestsPageSkeleton coordinatorView showFilters={false} showTabs />);

    expect(screen.getAllByRole("status", { name: "Cargando solicitudes" })).toHaveLength(2);
    expect(document.querySelector("[aria-busy=\"true\"]")).toBeInTheDocument();
  });
});
