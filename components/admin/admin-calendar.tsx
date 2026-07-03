"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import type { CalendarCell } from "@/lib/calendar/dates";
import { AdminDayCell } from "./admin-day-cell";
import { AdminDayModal } from "./admin-day-modal";

export type AdminCalendarEntry = {
  date: string;
  userId: string;
  userName: string;
  userEmail: string;
};

export type AdminCalendarDay = Exclude<CalendarCell, null> & {
  entries: AdminCalendarEntry[];
};

type AdminCalendarProps = {
  cells: CalendarCell[];
  currentMonthHref: string;
  entriesByDate: Record<string, AdminCalendarEntry[]>;
  monthName: string;
  nextMonthHref: string;
  previousMonthHref: string;
  showCurrentMonthLink: boolean;
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function AdminCalendar({
  cells,
  currentMonthHref,
  entriesByDate,
  monthName,
  nextMonthHref,
  previousMonthHref,
  showCurrentMonthLink,
}: AdminCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<AdminCalendarDay | null>(null);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold capitalize text-zinc-950">{monthName}</h2>
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

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((weekDay) => (
          <div key={weekDay} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {weekDay}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="min-h-32 rounded-xl border border-transparent" />;
          }

          const day = {
            ...cell,
            entries: entriesByDate[cell.date] ?? [],
          };

          return <AdminDayCell day={day} key={cell.date} onSelect={setSelectedDay} />;
        })}
      </div>

      {selectedDay ? <AdminDayModal day={selectedDay} onClose={() => setSelectedDay(null)} /> : null}
    </div>
  );
}
