import { GeneratedAvatar } from "@/components/common/generated-avatar";
import type { AdminCalendarDay } from "./admin-calendar";

type AdminDayModalProps = {
  day: AdminCalendarDay;
  onClose: () => void;
};

export function AdminDayModal({ day, onClose }: AdminDayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4" onClick={onClose}>
      <section
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Teletrabajo</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">{day.date}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {day.entries.length} {day.entries.length === 1 ? "persona" : "personas"} trabajando desde casa
            </p>
          </div>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <ul className="mt-6 max-h-96 space-y-3 overflow-auto">
          {day.entries.map((entry) => (
            <li className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3" key={entry.userId}>
              <GeneratedAvatar className="size-10 text-sm" name={entry.userName} />
              <div>
                <p className="text-sm font-medium text-zinc-950">{entry.userName}</p>
                <p className="text-xs text-zinc-500">{entry.userEmail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
