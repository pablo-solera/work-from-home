"use client";

import { useId, useState } from "react";
import { GeneratedAvatar } from "@/components/common/generated-avatar";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { ABSENCE_SECTIONS, type AbsenceSectionKey } from "@/lib/absences/absence-sections";
import type { DaySections } from "@/lib/absences/absence-service";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import { useModalDismiss } from "@/lib/hooks/use-modal-dismiss";
import type { AdminCalendarDay } from "./admin-calendar";

type AdminDayModalProps = {
  day: AdminCalendarDay;
  detail: DaySections | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
};

export function AdminDayModal({ day, detail, error, loading, onClose }: AdminDayModalProps) {
  const dialogRef = useModalDismiss<HTMLElement>(onClose);
  const titleId = useId();
  const [openSections, setOpenSections] = useState<Set<AbsenceSectionKey>>(new Set());

  const sections = detail ? ABSENCE_SECTIONS.map((section) => ({
      ...section,
      entries: detail[section.key],
    })).filter((section) => section.entries.length > 0) : [];

  const hasPeople = sections.length > 0;

  function toggleSection(key: AbsenceSectionKey) {
    setOpenSections((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4" onClick={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Detalle del día</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950" id={titleId}>{formatDateKeyForDisplay(day.date)}</h2>
          </div>
          <button aria-label="Cerrar" className="inline-flex cursor-pointer items-center justify-center p-1.5 text-zinc-500 hover:text-zinc-950" onClick={onClose} type="button">
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="mt-6 max-h-[28rem] space-y-3 overflow-auto overscroll-contain">
          {loading ? (
            <p aria-live="polite" className="text-sm text-zinc-500">Cargando detalle…</p>
          ) : error ? (
            <p aria-live="polite" className="text-sm text-red-600">{error}</p>
          ) : hasPeople ? (
            sections.map((section) => {
              const isOpen = openSections.has(section.key);
              const panelId = `day-section-${section.key}`;

              return (
                <div className="overflow-hidden rounded-xl border border-zinc-200" key={section.key}>
                  <button
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-50"
                    onClick={() => toggleSection(section.key)}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRightIcon className={`size-4 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      <span className="text-sm font-semibold text-zinc-950">{section.label}</span>
                    </span>
                    <span className="text-xs font-medium text-zinc-500">
                      {section.entries.length} {section.entries.length === 1 ? "persona" : "personas"}
                    </span>
                  </button>

                  {isOpen ? (
                    <ul className="space-y-3 border-t border-zinc-100 p-3" id={panelId} role="region">
                      {section.entries.map((entry, index) => (
                        <li className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3" key={entry.userId ?? `${entry.userName}-${index}`}>
                          <GeneratedAvatar className="size-10 text-sm" name={entry.userName} />
                          <div>
                            <p className="text-sm font-medium text-zinc-950">{entry.userName}</p>
                            {entry.userEmail ? <p className="text-xs text-zinc-500">{entry.userEmail}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-zinc-500">Sin registros para este día.</p>
          )}
        </div>
      </section>
    </div>
  );
}
