import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { requireUser } from "@/lib/auth/guards";
import { getAdminCalendarOverview, getAdminUserCalendar } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";
import { findUserById } from "@/lib/users/user-repository";

type CoveragePageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

function coverageHref(year: number, month: number, employeeId?: string) {
  const employeeParam = employeeId && employeeId !== "all" ? `&employeeId=${employeeId}` : "";

  return `/coverage?year=${year}&month=${month}${employeeParam}`;
}

export default async function CoveragePage({ searchParams }: CoveragePageProps) {
  const user = await requireUser();
  const dbUser = await findUserById(user.id);

  if (user.role !== "admin" && !dbUser?.canEditAllWfh) {
    redirect("/calendar");
  }

  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedUserId = params?.employeeId ?? "all";
  const currentMonth = getCurrentCalendarMonth();
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;
  const overview = await getAdminCalendarOverview(year, month);

  if (selectedUserId !== "all") {
    const userCalendar = await getAdminUserCalendar(selectedUserId, year, month);

    if (userCalendar) {
      return (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">Cobertura</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {userCalendar.user.name}</h1>
          </div>
          <EmployeeCalendarFilter
            allLabel="Todos"
            basePath="/coverage"
            employees={overview.users}
            label="Usuario"
            month={month}
            selectedEmployeeId={selectedUserId}
            year={year}
          />
          <MonthCalendar
            canEdit
            cells={userCalendar.cells}
            currentMonthHref={coverageHref(currentMonth.year, currentMonth.month, selectedUserId)}
            month={month}
            monthName={userCalendar.monthName}
            nextMonthHref={coverageHref(getNextMonth(year, month).year, getNextMonth(year, month).month, selectedUserId)}
            previousMonthHref={coverageHref(getPreviousMonth(year, month).year, getPreviousMonth(year, month).month, selectedUserId)}
            selectedDates={userCalendar.selectedDates}
            showCurrentMonthLink={showCurrentMonthLink}
            targetUserId={userCalendar.user.id}
            year={year}
          />
        </section>
      );
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Cobertura</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Vista global de teletrabajo</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">Edita días de teletrabajo en situaciones de cobertura, sin acceder a la gestión de usuarios.</p>
      </div>
      <EmployeeCalendarFilter allLabel="Todos" basePath="/coverage" employees={overview.users} label="Usuario" month={month} selectedEmployeeId="all" year={year} />
      <AdminCalendar
        cells={overview.cells}
        currentMonthHref={createMonthHref("/coverage", currentMonth)}
        sectionsByDate={overview.sectionsByDate}
        monthName={overview.monthName}
        nextMonthHref={createMonthHref("/coverage", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/coverage", getPreviousMonth(year, month))}
        showCurrentMonthLink={showCurrentMonthLink}
      />
    </section>
  );
}
