// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dropdown } from "@/components/common/dropdown";

const options = [
  { label: "Todos", value: "all" },
  { hint: "ana@example.com", label: "Ángela Ruiz", value: "1" },
  { hint: "beto@example.com", label: "Beto Gil", value: "2" },
];

function renderDropdown(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  const onChange = vi.fn();
  render(<Dropdown aria-label="Usuario" onChange={onChange} options={options} value="all" {...props} />);
  return onChange;
}

describe("Dropdown", () => {
  it("shows the selected option and opens a listbox with the options", () => {
    renderDropdown();
    const trigger = screen.getByRole("button", { name: "Usuario: Todos" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange, closes and returns focus to the trigger", () => {
    const onChange = renderDropdown();
    fireEvent.click(screen.getByRole("button", { name: "Usuario: Todos" }));
    fireEvent.click(screen.getByRole("option", { name: /Beto Gil/ }));
    expect(onChange).toHaveBeenCalledWith("2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("searches ignoring accents when searchable", () => {
    renderDropdown({ searchable: true });
    fireEvent.click(screen.getByRole("button", { name: "Usuario: Todos" }));
    fireEvent.change(screen.getByLabelText("Buscar opción"), { target: { value: "angela" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Buscar opción"), { target: { value: "zzz" } });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("closes with Escape and moves between options with the arrow keys", () => {
    renderDropdown();
    const trigger = screen.getByRole("button", { name: "Usuario: Todos" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("option");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
