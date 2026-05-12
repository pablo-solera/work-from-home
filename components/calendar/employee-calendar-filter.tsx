"use client";

import { useRouter } from "next/navigation";

type EmployeeCalendarFilterProps = {
  basePath: string;
  employees: Array<{ id: string; name: string; email: string }>;
  month: number;
  selectedEmployeeId: string;
  year: number;
};

export function EmployeeCalendarFilter({ basePath, employees, month, selectedEmployeeId, year }: EmployeeCalendarFilterProps) {
  const router = useRouter();

  return (
    <label className="block max-w-sm space-y-2">
      <span className="text-sm font-medium text-zinc-700">Empleado</span>
      <select
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950"
        onChange={(event) => router.push(`${basePath}?year=${year}&month=${month}&employeeId=${event.target.value}`)}
        value={selectedEmployeeId}
      >
        <option value="all">Todos</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name} · {employee.email}
          </option>
        ))}
      </select>
    </label>
  );
}
