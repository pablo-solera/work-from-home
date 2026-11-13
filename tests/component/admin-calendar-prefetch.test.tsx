// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { getCalendarDays } from "@/lib/calendar/dates";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));

const calendar = getCalendarDays(2030, 8);
const summaries = Object.fromEntries(calendar.cells.flatMap((cell) => cell && !cell.isWeekend && !cell.isHoliday ? [[cell.date, { absenceCount: 1, date: cell.date, officeCount: 10, remoteCount: 3 }]] : []));
const emptySections = { enOficina: [], teletrabajo: [], vacaciones: [], ausencias: [], bajas: [], viajes: [], permisos: [], excedencia: [], mudanza: [], noComprende: [] };

function renderCalendar() {
  return render(<AdminCalendar cells={calendar.cells} currentMonthHref="#" daySummariesByDate={summaries} monthName={calendar.monthName} nextMonthHref="#" previousMonthHref="#" showCurrentMonthLink />);
}

describe("AdminCalendar day detail loading", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ sections: emptySections }) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads nothing while the pointer sweeps or the keyboard tabs across the month", () => {
    renderCalendar();
    for (const cell of screen.getAllByRole("button", { name: /abrir detalle/ })) {
      fireEvent.pointerEnter(cell);
      fireEvent.pointerOver(cell);
      fireEvent.mouseMove(cell);
      fireEvent.focus(cell);
      fireEvent.pointerLeave(cell);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts loading on press and the following click reuses that single request", async () => {
    renderCalendar();
    const cell = screen.getAllByRole("button", { name: /abrir detalle/ })[2];

    fireEvent.pointerDown(cell);
    fireEvent.click(cell);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/calendar/day?date=");
  });

  it("starts loading with Enter or Space from the keyboard", () => {
    renderCalendar();
    const cells = screen.getAllByRole("button", { name: /abrir detalle/ });

    fireEvent.keyDown(cells[0], { key: "Enter" });
    fireEvent.keyDown(cells[1], { key: " " });
    fireEvent.keyDown(cells[2], { key: "ArrowRight" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
