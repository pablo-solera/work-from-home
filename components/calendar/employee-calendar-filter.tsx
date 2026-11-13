"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/common/dropdown";
import { createCalendarHref } from "@/lib/calendar/links";

type EmployeeCalendarFilterProps = {
  allLabel?: string;
  basePath: string;
  employees: Array<{ id: string; name: string; email: string }>;
  label?: string;
  month: number;
  selectedEmployeeId: string;
  year: number;
};

export function EmployeeCalendarFilter({ allLabel = "Todos", basePath, employees, label = "Empleado", month, selectedEmployeeId, year }: EmployeeCalendarFilterProps) {
  const router = useRouter();

  const options = [{ label: allLabel, value: "all" }, ...employees.map((employee) => ({ hint: employee.email, label: employee.name, value: employee.id }))];

  return (
    <div className="max-w-sm space-y-2">
      <span className="block text-sm font-medium text-zinc-700">{label}</span>
      <Dropdown
        aria-label={label}
        onChange={(employeeId) => router.push(createCalendarHref(basePath, { employeeId, month, year }))}
        options={options}
        searchable={employees.length > 6}
        value={selectedEmployeeId}
      />
    </div>
  );
}
