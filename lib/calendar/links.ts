export function createCalendarHref(basePath: string, { employeeId, month, year }: { employeeId?: string; month: number; year: number }) {
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  if (employeeId && employeeId !== "all") params.set("employeeId", employeeId);
  return `${basePath}?${params.toString()}`;
}
