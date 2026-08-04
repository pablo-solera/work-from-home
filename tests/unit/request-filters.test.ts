import { describe, expect, it } from "vitest";
import { parseRequestFilters } from "@/lib/requests/request-filters";

describe("parseRequestFilters", () => {
  it("parses object and URLSearchParams values", () => {
    expect(parseRequestFilters({ date: "month", status: "accepted" })).toEqual({ date: "month", status: "accepted" });
    expect(parseRequestFilters(new URLSearchParams("date=week&status=rejected"))).toEqual({ date: "week", status: "rejected" });
  });

  it("uses defaults for missing or invalid values", () => {
    expect(parseRequestFilters()).toEqual({ date: "all", status: "all" });
    expect(parseRequestFilters({ date: "year", status: "unknown" }, "pending")).toEqual({ date: "all", status: "pending" });
    expect(parseRequestFilters({ status: "all" }, "pending")).toEqual({ date: "all", status: "all" });
  });
});
