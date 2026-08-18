// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayCell, isDateLockedForMode } from "@/components/calendar/day-cell";

vi.mock("@/app/(dashboard)/calendar/actions", () => ({
  toggleWorkFromHomeDayAction: vi.fn(),
}));

const baseProps = {
  canEdit: true,
  date: "2026-08-05",
  dayNumber: 5,
  holidayName: null,
  isHoliday: false,
  isToday: true,
  isWeekend: false,
  month: 8,
  pending: false,
  requestSelected: false,
  selected: false,
  targetUserId: "user-1",
  year: 2026,
  onRequestClick: vi.fn(),
};

describe("DayCell request states", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T08:15:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("locks every request mode after the cutoff", () => {
    expect(isDateLockedForMode("2026-08-05", "additional")).toBe(true);
    expect(isDateLockedForMode("2026-08-05", "substitution-source")).toBe(true);
    expect(isDateLockedForMode("2026-08-05", "substitution-target")).toBe(true);
  });

  it("locks today for additional days after the cutoff", () => {
    render(<DayCell {...baseProps} requestMode="additional" />);

    expect(screen.getByRole("button", { name: /Fuera de plazo/ })).toBeDisabled();
  });

  it("explains why an already assigned day cannot be selected", () => {
    render(<DayCell {...baseProps} date="2026-08-06" dayNumber={6} requestMode="additional" selected />);

    expect(screen.getByRole("button", { name: /Ya asignado/ })).toBeDisabled();
  });

  it("explains why a day without telework cannot be a substitution source", () => {
    render(<DayCell {...baseProps} date="2026-08-06" dayNumber={6} requestMode="substitution-source" />);

    expect(screen.getByRole("button", { name: /Sin teletrabajo/ })).toBeDisabled();
  });

  it("explains why a day without telework cannot be removed", () => {
    render(<DayCell {...baseProps} date="2026-08-06" dayNumber={6} requestMode="removal" />);

    expect(screen.getByRole("button", { name: /Sin teletrabajo/ })).toBeDisabled();
  });

  it("calls the optimistic toggle callback with the opposite state", () => {
    const onToggle = vi.fn();
    render(<DayCell {...baseProps} requestMode={null} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: /Marcar teletrabajo/ }));

    expect(onToggle).toHaveBeenCalledWith("2026-08-05", true);
  });

  it("disables the toggle while it is saving", () => {
    render(<DayCell {...baseProps} requestMode={null} saving onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Marcar teletrabajo/ })).toBeDisabled();
  });

  it("shows the real allowance without enforcing it", () => {
    render(<DayCell {...baseProps} requestMode={null} weeklyAllowance={2} weeklyCount={2} enforceWeeklyAllowance={false} onToggle={vi.fn()} />);

    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcar teletrabajo/ })).toBeEnabled();
  });
});
