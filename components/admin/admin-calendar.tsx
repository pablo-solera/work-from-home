"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import type { CalendarCell } from "@/lib/calendar/dates";
import type { AdminCalendarDaySummary } from "@/lib/calendar/calendar-service";
import { AdminDayCell } from "./admin-day-cell";
import { AdminDayModal } from "./admin-day-modal";

export type AdminCalendarDay = Exclude<CalendarCell, null> & {
  absenceCount: number;
  officeCount: number;
  remoteCount: number;
};

type AdminCalendarProps = {
  cells: CalendarCell[];
  currentMonthHref: string;
  daySummariesByDate: Record<string, AdminCalendarDaySummary>;
  monthName: string;
  nextMonthHref: string;
  previousMonthHref: string;
  showCurrentMonthLink: boolean;
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function AdminCalendar({
  cells,
  currentMonthHref,
  daySummariesByDate,
  monthName,
  nextMonthHref,
  previousMonthHref,
  showCurrentMonthLink,
}: AdminCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<AdminCalendarDay | null>(null);
  const [details, setDetails] = useState<Record<string, import("@/lib/absences/absence-service").DaySections>>({});
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  function selectDay(day: AdminCalendarDay) {
    setSelectedDay(day);
    setDetailError(null);
    if (details[day.date]) return;

    setLoadingDate(day.date);
    fetch(`/api/calendar/day?date=${encodeURIComponent(day.date)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el detalle del día.");
        return response.json() as Promise<{ sections: import("@/lib/absences/absence-service").DaySections }>;
      })
      .then((data) => setDetails((current) => ({ ...current, [day.date]: data.sections })))
      .catch((error: unknown) => setDetailError(error instanceof Error ? error.message : "No se pudo cargar el detalle del día."))
      .finally(() => setLoadingDate(null));
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold first-letter:uppercase text-zinc-950">{monthName}</h2>
          <div className="inline-flex items-center gap-2">
            <Link aria-label="Mes anterior" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100" href={previousMonthHref}>
              <ChevronLeftIcon className="size-5" />
            </Link>
            {showCurrentMonthLink ? (
              <Link className="cursor-pointer rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800" href={currentMonthHref}>
                Mes actual
              </Link>
            ) : (
              <span aria-disabled="true" className="cursor-not-allowed rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white opacity-50">
                Mes actual
              </span>
            )}
            <Link aria-label="Mes siguiente" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100" href={nextMonthHref}>
              <ChevronRightIcon className="size-5" />
            </Link>
          </div>
        </div>
      </div>

      <div aria-label={`Calendario de ${monthName}`} className="grid grid-cols-7 gap-2" role="grid">
        {weekDays.map((weekDay) => (
          <div key={weekDay} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500" role="columnheader">
            {weekDay}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="min-h-32 rounded-xl border border-transparent" />;
          }

          const day = {
            ...cell,
            ...(daySummariesByDate[cell.date] ?? { absenceCount: 0, officeCount: 0, remoteCount: 0 }),
          };

          return <AdminDayCell day={day} key={cell.date} onSelect={selectDay} />;
        })}
      </div>

      {selectedDay ? <AdminDayModal day={selectedDay} detail={details[selectedDay.date] ?? null} error={detailError} loading={loadingDate === selectedDay.date} onClose={() => setSelectedDay(null)} /> : null}
    </div>
  );
}
