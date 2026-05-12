import Link from "next/link";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminCalendarOverview } from "@/lib/calendar/calendar-service";
import { createMonthHref, getCurrentCalendarMonth, getNextMonth, getPreviousMonth, parseCalendarMonth } from "@/lib/calendar/dates";

type AdminPageProps = {
  searchParams?: Promise<{ year?: string; month?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const { year, month } = parseCalendarMonth(params?.year, params?.month);
  const currentMonth = getCurrentCalendarMonth();
  const calendar = await getAdminCalendarOverview(year, month);
  const showCurrentMonthLink = year !== currentMonth.year || month !== currentMonth.month;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-zinc-500">Dashboard admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Vista global de teletrabajo</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-400" href="/calendar">
          <h2 className="font-semibold text-zinc-950">Mi calendario</h2>
          <p className="mt-2 text-sm text-zinc-600">Marca tus propios días de teletrabajo.</p>
        </Link>
        <Link className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-400" href="/admin/users">
          <h2 className="font-semibold text-zinc-950">Gestión de usuarios</h2>
          <p className="mt-2 text-sm text-zinc-600">Crea usuarios de forma masiva pegando correos.</p>
        </Link>
      </div>
      <AdminCalendar
        cells={calendar.cells}
        currentMonthHref={createMonthHref("/admin", currentMonth)}
        entriesByDate={calendar.entriesByDate}
        monthName={calendar.monthName}
        nextMonthHref={createMonthHref("/admin", getNextMonth(year, month))}
        previousMonthHref={createMonthHref("/admin", getPreviousMonth(year, month))}
        showCurrentMonthLink={showCurrentMonthLink}
      />
    </section>
  );
}
