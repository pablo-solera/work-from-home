"use client";

import { useState } from "react";
import type { CalendarCell } from "@/lib/calendar/dates";
import type { AdminCalendarDaySummary } from "@/lib/calendar/calendar-service";
import { CalendarGrid, CalendarPanel, EmptyCalendarCell } from "@/components/calendar/calendar-shell";
import { AdminDayCell } from "./admin-day-cell";
import { AdminDayModal } from "./admin-day-modal";

export type AdminCalendarDay = Exclude<CalendarCell, null> & {
  absenceCount: number;
  officeCount: number;
  remoteCount: number;
  isOutOfRange?: boolean;
};

type AdminCalendarProps = {
  cells: CalendarCell[];
  currentMonthHref: string;
  daySummariesByDate: Record<string, AdminCalendarDaySummary>;
  dayDetailEndpoint?: string;
  monthName: string;
  nextMonthHref: string;
  previousMonthHref: string;
  showCurrentMonthLink: boolean;
};

export function AdminCalendar({
  cells,
  currentMonthHref,
  daySummariesByDate,
  dayDetailEndpoint = "/api/calendar/day",
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
    fetch(`${dayDetailEndpoint}?date=${encodeURIComponent(day.date)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el detalle del día.");
        return response.json() as Promise<{ sections: import("@/lib/absences/absence-service").DaySections }>;
      })
      .then((data) => setDetails((current) => ({ ...current, [day.date]: data.sections })))
      .catch((error: unknown) => setDetailError(error instanceof Error ? error.message : "No se pudo cargar el detalle del día."))
      .finally(() => setLoadingDate(null));
  }

  return (
    <CalendarPanel monthName={monthName} navigation={{ currentMonthHref, nextMonthHref, previousMonthHref, showCurrentMonthLink }}>
      <CalendarGrid label={`Calendario de ${monthName}`}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <EmptyCalendarCell index={index} minCellHeight="min-h-32" key={`empty-${index}`} />;
          }

          const day = {
            ...cell,
            ...(daySummariesByDate[cell.date] ?? { absenceCount: 0, officeCount: 0, remoteCount: 0 }),
          };

          return <AdminDayCell day={day} key={cell.date} onSelect={selectDay} />;
        })}
      </CalendarGrid>

      {selectedDay ? <AdminDayModal day={selectedDay} detail={details[selectedDay.date] ?? null} error={detailError} loading={loadingDate === selectedDay.date} onClose={() => setSelectedDay(null)} /> : null}
    </CalendarPanel>
  );
}
