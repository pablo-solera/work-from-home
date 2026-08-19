import { describe, expect, it } from "vitest";
import { hasReachedWeeklyAllowance, WEEKLY_ALLOWANCE_ERROR } from "@/lib/calendar/calendar-repository";

describe("weekly allowance rule", () => {
  it("reaches the allowance when usage equals the limit", () => {
    expect(hasReachedWeeklyAllowance(2, 2)).toBe(true);
  });

  it("does not reach the allowance below the limit", () => {
    expect(hasReachedWeeklyAllowance(1, 2)).toBe(false);
  });

  it("exposes the user-facing allowance error", () => {
    expect(WEEKLY_ALLOWANCE_ERROR).toBe("Has alcanzado el cupo semanal de teletrabajo.");
  });
});
