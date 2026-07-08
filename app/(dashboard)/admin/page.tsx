import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { EmployeeCalendarFilter } from "@/components/calendar/employee-calendar-filter";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminCalendarOverview, getAdminUserCalendar } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";

type AdminPageProps = {
  searchParams?: Promise<{ year?: string; month?: string; employeeId?: string }>;
};

function adminHref(year: number, month: number, employeeId?: string) {
  const employeeParam = employeeId && employeeId !== "all" ? `&employeeId=${employeeId}` : "";

  return `/admin?year=${year}&month=${month}${employeeParam}`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const selectedUserId = params?.employeeId ?? "all";
  const currentMonth = getCurrentCalendarMonth();
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;
  const overview = await getAdminCalendarOverview(year, month);

  if (selectedUserId === admin.id) {
    redirect(adminHref(year, month));
  }

  const selectableUsers = overview.users.filter((user) => user.id !== admin.id);

  const adminLinks = (
    <div className="grid gap-4 md:grid-cols-2">
      <Link className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-400" href="/calendar">
        <h2 className="font-semibold text-zinc-950">Mi calendario</h2>
        <p className="mt-2 text-sm text-zinc-600">Marca tus propios días de teletrabajo.</p>
      </Link>
      <Link className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-400" href="/admin/users">
        <h2 className="font-semibold text-zinc-950">Gestión de usuarios</h2>
        <p className="mt-2 text-sm text-zinc-600">Crea usuarios de forma masiva pegando correos.</p>
      </Link>
    </div>
  );

  if (selectedUserId !== "all") {
    const userCalendar = await getAdminUserCalendar(selectedUserId, year, month);

    if (userCalendar) {
      return (
        <section className="space-y-8">
          <div>
            <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Teletrabajo de {userCalendar.user.name}</h1>
          </div>
          {adminLinks}
          <EmployeeCalendarFilter
            allLabel="Todos"
            basePath="/admin"
            employees={selectableUsers}
            label="Usuario"
            month={month}
            selectedEmployeeId={selectedUserId}
            year={year}
          />
          <MonthCalendar
            canEdit
            cells={userCalendar.cells}
            currentMonthHref={adminHref(currentMonth.year, currentMonth.month, selectedUserId)}
            month={month}
            monthName={userCalendar.monthName}
            nextMonthHref={adminHref(getNextMonth(year, month).year, getNextMonth(year, month).month, selectedUserId)}
            previousMonthHref={adminHref(getPreviousMonth(year, month).year, getPreviousMonth(year, month).month, selectedUserId)}
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
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Vista global de teletrabajo</h1>
      </div>
      {adminLinks}
      <EmployeeCalendarFilter
        allLabel="Todos"
        basePath="/admin"
        employees={selectableUsers}
        label="Usuario"
        month={month}
        selectedEmployeeId="all"
        year={year}
      />
      <AdminCalendar
        cells={overview.cells}
        currentMonthHref={createMonthHref("/admin", currentMonth)}
        sectionsByDate={overview.sectionsByDate}
        monthName={overview.monthName}
        nextMonthHref={createMonthHref("/admin", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/admin", getPreviousMonth(year, month))}
        showCurrentMonthLink={showCurrentMonthLink}
      />
    </section>
  );
}
