"use client";

import { useRouter } from "next/navigation";
import { fieldClasses } from "@/components/common/form-classes";
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

  return (
    <label className="block max-w-sm space-y-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        autoComplete="off"
        className={`${fieldClasses} cursor-pointer`}
        name="employee"
        onChange={(event) => router.push(createCalendarHref(basePath, { employeeId: event.target.value, month, year }))}
        value={selectedEmployeeId}
      >
        <option value="all">{allLabel}</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name} · {employee.email}
          </option>
        ))}
      </select>
    </label>
  );
}
