import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/common/button";

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
      <Link aria-label="Mes anterior" className={buttonClasses("secondary", "icon")} href={previousMonthHref}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Link>
      {showCurrentMonthLink
        ? <Link className={buttonClasses("primary", "md")} href={currentMonthHref}>Mes actual</Link>
        : <span aria-disabled="true" className={`${buttonClasses("secondary", "md")} cursor-not-allowed text-zinc-500`}>Mes actual</span>}
      <Link aria-label="Mes siguiente" className={buttonClasses("secondary", "icon")} href={nextMonthHref}>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </div>
  );
}

export type LegendItem = { label: string; marker: string };

export const PERSONAL_LEGEND: LegendItem[] = [
  { label: "Teletrabajo", marker: "bg-indigo-600" },
  { label: "Solicitud pendiente", marker: "bg-amber-500" },
  { label: "Festivo o fin de semana", marker: "bg-tdia-festivo" },
  { label: "Hoy", marker: "bg-zinc-950" },
];

export const OVERVIEW_LEGEND: LegendItem[] = [
  { label: "En oficina", marker: "bg-zinc-500" },
  { label: "Teletrabajo", marker: "bg-indigo-600" },
  { label: "Ausencias", marker: "bg-tdia-ausencias" },
  { label: "Festivo o fin de semana", marker: "bg-tdia-festivo" },
];

export function CalendarLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul aria-label="Leyenda" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-700">
      {items.map((item) => (
        <li className="flex items-center gap-2" key={item.label}>
          <span aria-hidden="true" className={`size-2.5 rounded-full ${item.marker}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function CalendarPanel({ children, legend, monthName, navigation, tools }: { children: React.ReactNode; legend?: LegendItem[]; monthName: string; navigation: MonthNavigationProps; tools?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-panel sm:p-6">
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-zinc-950 first-letter:uppercase">{monthName}</h2>
          <MonthNavigation {...navigation} />
        </div>
        {tools}
      </div>
      {children}
      {legend ? <CalendarLegend items={legend} /> : null}
    </div>
  );
}

export function CalendarGrid({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div aria-label={label} className="grid grid-cols-7 gap-1 sm:gap-2" role="group">
      {WEEK_DAYS.map((weekDay) => <div key={weekDay} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600">{weekDay}</div>)}
      {children}
    </div>
  );
}

export function EmptyCalendarCell({ index, minCellHeight = "min-h-24" }: { index: number; minCellHeight?: "min-h-24" | "min-h-32" }) {
  const height = minCellHeight === "min-h-32" ? "min-h-20 sm:min-h-32" : "min-h-20 sm:min-h-24";
  return <div aria-hidden="true" className={`${height} rounded-xl border border-transparent`} key={`empty-${index}`} />;
}
