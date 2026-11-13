"use client";

import { useRef, useState } from "react";
import type { CalendarCell } from "@/lib/calendar/dates";
import type { AdminCalendarDaySummary } from "@/lib/calendar/calendar-service";
import { CalendarGrid, CalendarPanel, EmptyCalendarCell, OVERVIEW_LEGEND } from "@/components/calendar/calendar-shell";
import { AdminDayCell, canOpenDayDetails } from "./admin-day-cell";
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inflight = useRef(new Set<string>());

  const days = cells.flatMap((cell) => (cell ? [{ ...cell, ...(daySummariesByDate[cell.date] ?? { absenceCount: 0, officeCount: 0, remoteCount: 0 }) }] : []));
  const openableDays = days.filter(canOpenDayDetails);
  const selectedIndex = selectedDay ? openableDays.findIndex((day) => day.date === selectedDay.date) : -1;
  const previousDay = selectedIndex > 0 ? openableDays[selectedIndex - 1] : undefined;
  const nextDay = selectedIndex !== -1 ? openableDays[selectedIndex + 1] : undefined;

  function loadDetail(date: string) {
    if (details[date] || inflight.current.has(date)) return;

    inflight.current.add(date);
    fetch(`${dayDetailEndpoint}?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el detalle del día.");
        return response.json() as Promise<{ sections: import("@/lib/absences/absence-service").DaySections }>;
      })
      .then((data) => setDetails((current) => ({ ...current, [date]: data.sections })))
      .catch((error: unknown) => setErrors((current) => ({ ...current, [date]: error instanceof Error ? error.message : "No se pudo cargar el detalle del día." })))
      .finally(() => inflight.current.delete(date));
  }

  function selectDay(day: AdminCalendarDay) {
    setSelectedDay(day);
    if (errors[day.date]) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([date]) => date !== day.date)));
    loadDetail(day.date);
  }

  return (
    <CalendarPanel legend={OVERVIEW_LEGEND} monthName={monthName} navigation={{ currentMonthHref, nextMonthHref, previousMonthHref, showCurrentMonthLink }}>
      <CalendarGrid label={`Calendario de ${monthName}`}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <EmptyCalendarCell index={index} minCellHeight="min-h-32" key={`empty-${index}`} />;
          }

          const day = {
            ...cell,
            ...(daySummariesByDate[cell.date] ?? { absenceCount: 0, officeCount: 0, remoteCount: 0 }),
          };

          return <AdminDayCell day={day} key={cell.date} onPrefetch={(pressed) => loadDetail(pressed.date)} onSelect={selectDay} />;
        })}
      </CalendarGrid>

      {selectedDay ? <AdminDayModal day={selectedDay} detail={details[selectedDay.date] ?? null} error={errors[selectedDay.date] ?? null} loading={!details[selectedDay.date] && !errors[selectedDay.date]} onClose={() => setSelectedDay(null)} onNextDay={nextDay ? () => selectDay(nextDay) : undefined} onPreviousDay={previousDay ? () => selectDay(previousDay) : undefined} /> : null}
    </CalendarPanel>
  );
}
