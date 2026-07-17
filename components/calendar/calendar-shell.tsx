import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";

export const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type MonthNavigationProps = {
  currentMonthHref: string;
  nextMonthHref: string;
  previousMonthHref: string;
  showCurrentMonthLink: boolean;
};

export function MonthNavigation({ currentMonthHref, nextMonthHref, previousMonthHref, showCurrentMonthLink }: MonthNavigationProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <Link aria-label="Mes anterior" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" href={previousMonthHref}>
        <ChevronLeftIcon className="size-5" />
      </Link>
      {showCurrentMonthLink ? <Link className="cursor-pointer rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" href={currentMonthHref}>Mes actual</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white opacity-50">Mes actual</span>}
      <Link aria-label="Mes siguiente" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" href={nextMonthHref}>
        <ChevronRightIcon className="size-5" />
      </Link>
    </div>
  );
}

export function CalendarPanel({ children, monthName, navigation, tools }: { children: React.ReactNode; monthName: string; navigation: MonthNavigationProps; tools?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold first-letter:uppercase text-zinc-950">{monthName}</h2>
          <MonthNavigation {...navigation} />
        </div>
        {tools}
      </div>
      {children}
    </div>
  );
}

export function CalendarGrid({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div aria-label={label} className="grid grid-cols-7 gap-2" role="grid">
      {WEEK_DAYS.map((weekDay) => <div key={weekDay} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500" role="columnheader">{weekDay}</div>)}
      {children}
    </div>
  );
}

export function EmptyCalendarCell({ index, minCellHeight = "min-h-24" }: { index: number; minCellHeight?: "min-h-24" | "min-h-32" }) {
  return <div aria-hidden="true" className={`${minCellHeight} rounded-xl border border-transparent`} key={`empty-${index}`} />;
}
