// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminDayModal } from "@/components/admin/admin-day-modal";
import type { AdminCalendarDay } from "@/components/admin/admin-calendar";
import { createEmptySections } from "@/lib/absences/absence-service";

const day: AdminCalendarDay = { absenceCount: 1, date: "2030-08-05", dayNumber: 5, holidayName: null, isHoliday: false, isToday: false, isWeekend: false, officeCount: 2, remoteCount: 1 };
const person = (id: string, name: string, email: string) => ({ userEmail: email, userId: id, userName: name });

function buildDetail() {
  const sections = createEmptySections();
  sections.enOficina = [person("1", "Ángela Ruiz", "angela@example.com"), person("2", "Beto Gil", "beto@example.com")];
  sections.teletrabajo = [person("3", "Carla Mora", "carla@example.com")];
  sections.vacaciones = [person("4", "Daniel Sanz", "daniel@example.com")];
  return sections;
}

function renderModal(props: Partial<React.ComponentProps<typeof AdminDayModal>> = {}) {
  return render(<AdminDayModal day={day} detail={buildDetail()} error={null} loading={false} onClose={vi.fn()} {...props} />);
}

describe("AdminDayModal", () => {
  it("opens work sections by default and keeps the office list collapsed", () => {
    renderModal();
    expect(screen.getByText("Carla Mora")).toBeInTheDocument();
    expect(screen.getByText("Daniel Sanz")).toBeInTheDocument();
    expect(screen.queryByText("Beto Gil")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /En oficina/, expanded: false }));
    expect(screen.getByText("Beto Gil")).toBeInTheDocument();
  });

  it("searches by name or email ignoring accents and opens matching sections", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Buscar persona"), { target: { value: "angela" } });
    expect(screen.getByRole("region", { name: "En oficina" })).toHaveTextContent("Ángela Ruiz");
    expect(screen.queryByText("Carla Mora")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 de 4 personas");

    fireEvent.change(screen.getByLabelText("Buscar persona"), { target: { value: "daniel@" } });
    expect(within(screen.getByRole("region", { name: "Vacaciones" })).getByText(/daniel/)).toBeInTheDocument();
  });

  it("shows an empty state and clears the search", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Buscar persona"), { target: { value: "zzz" } });
    expect(screen.getByText("Nadie coincide con «zzz».")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Borrar búsqueda" }).at(-1)!);
    expect(screen.getByText("Carla Mora")).toBeInTheDocument();
  });

  it("filters by section chip", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Teletrabajo\s*1/, pressed: false }));
    expect(screen.getByText("Carla Mora")).toBeInTheDocument();
    expect(screen.queryByText("Daniel Sanz")).not.toBeInTheDocument();
  });

  it("moves between days with the buttons and the arrow keys", () => {
    const onNextDay = vi.fn();
    const onPreviousDay = vi.fn();
    renderModal({ onNextDay, onPreviousDay });
    fireEvent.click(screen.getByRole("button", { name: "Día siguiente" }));
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onNextDay).toHaveBeenCalledTimes(1);
    expect(onPreviousDay).toHaveBeenCalledTimes(1);
  });

  it("caps long sections at 50 rows until the rest is requested", () => {
    const detail = createEmptySections();
    detail.teletrabajo = Array.from({ length: 62 }, (_, index) => person(`t${index}`, `Persona ${index}`, `persona${index}@example.com`));
    renderModal({ detail });
    const region = screen.getByRole("region", { name: "Teletrabajo" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar las 12 restantes" }));
    expect(within(region).getAllByRole("listitem")).toHaveLength(62);
  });

  it("disables unavailable navigation and shows an empty day", () => {
    renderModal({ detail: createEmptySections() });
    expect(screen.getByRole("button", { name: "Día anterior" })).toBeDisabled();
    expect(screen.getByText("Sin registros para este día.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar persona")).not.toBeInTheDocument();
  });
});
