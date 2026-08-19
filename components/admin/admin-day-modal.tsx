"use client";

import { useState } from "react";
import { GeneratedAvatar } from "@/components/common/generated-avatar";
import { ActionFeedback } from "@/components/common/action-feedback";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { Dialog } from "@/components/common/dialog";
import { DayDetailSkeleton } from "@/components/common/day-detail-skeleton";
import { ABSENCE_SECTIONS, type AbsenceSectionKey } from "@/lib/absences/absence-sections";
import type { DaySections } from "@/lib/absences/absence-service";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import type { AdminCalendarDay } from "./admin-calendar";

type AdminDayModalProps = {
  day: AdminCalendarDay;
  detail: DaySections | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
};

export function AdminDayModal({ day, detail, error, loading, onClose }: AdminDayModalProps) {
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
    <Dialog onDismiss={onClose}>
      <Dialog.Panel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Detalle del día</p>
            <Dialog.Title>{formatDateKeyForDisplay(day.date)}</Dialog.Title>
          </div>
          <Dialog.Close onClick={onClose} />
        </div>

        <div className="mt-6 max-h-[28rem] space-y-3 overflow-auto overscroll-contain">
          {loading ? (
            <DayDetailSkeleton />
          ) : error ? (
            <ActionFeedback error={error} />
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
      </Dialog.Panel>
    </Dialog>
  );
}
