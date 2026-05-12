import { toggleWorkFromHomeDayAction } from "@/app/(dashboard)/calendar/actions";

type DayCellProps = {
  date: string;
  dayNumber: number;
  isWeekend: boolean;
  month: number;
  selected: boolean;
  year: number;
};

export function DayCell({ date, dayNumber, isWeekend, month, selected, year }: DayCellProps) {
  if (isWeekend) {
    return (
      <div className="min-h-24 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-400">
        <span className="text-sm font-semibold">{dayNumber}</span>

      </div>
    );
  }

  return (
    <form action={toggleWorkFromHomeDayAction} className={`min-h-24 rounded-xl border p-3 ${selected ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-white"}`}>
      <input name="date" type="hidden" value={date} />
      <input name="enabled" type="hidden" value={selected ? "false" : "true"} />
      <input name="year" type="hidden" value={year} />
      <input name="month" type="hidden" value={month} />
      <div className="flex h-full flex-col justify-between gap-4">
        <span className="text-sm font-semibold text-zinc-950">{dayNumber}</span>
        <button className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer">
          {selected ? "Quitar" : "Marcar"}
        </button>
      </div>
    </form>
  );
}
