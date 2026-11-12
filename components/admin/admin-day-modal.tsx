"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GeneratedAvatar } from "@/components/common/generated-avatar";
import { ActionFeedback } from "@/components/common/action-feedback";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import { DayDetailSkeleton } from "@/components/common/day-detail-skeleton";
import { ABSENCE_SECTIONS, type AbsenceSectionKey } from "@/lib/absences/absence-sections";
import type { DaySections } from "@/lib/absences/absence-service";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";
import type { AdminCalendarDay } from "./admin-calendar";
import { SECTION_STYLES } from "./day-section-styles";

type AdminDayModalProps = {
  day: AdminCalendarDay;
  detail: DaySections | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onNextDay?: () => void;
  onPreviousDay?: () => void;
};

type Person = DaySections[AbsenceSectionKey][number];

const OPEN_BY_DEFAULT = new Set<AbsenceSectionKey>(["teletrabajo", "vacaciones", "ausencias", "bajas", "viajes", "permisos", "excedencia", "mudanza"]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function matches(person: Person, query: string) {
  return normalize(`${person.userName} ${person.userEmail ?? ""}`).includes(query);
}

function Highlight({ query, text }: { query: string; text: string }) {
  const normalized = normalize(text);
  const start = query ? normalized.indexOf(query) : -1;
  if (start === -1 || normalized.length !== text.length) return <>{text}</>;
  const end = start + query.length;
  return <>{text.slice(0, start)}<mark className="rounded-sm bg-sky-200 text-sky-950">{text.slice(start, end)}</mark>{text.slice(end)}</>;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

export function AdminDayModal({ day, detail, error, loading, onClose, onNextDay, onPreviousDay }: AdminDayModalProps) {
  const [overrides, setOverrides] = useState<Partial<Record<AbsenceSectionKey, boolean>>>({});
  const [activeSection, setActiveSection] = useState<AbsenceSectionKey | null>(null);
  const [rawQuery, setRawQuery] = useState("");
  const [shownDate, setShownDate] = useState(day.date);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigationRef = useRef({ onNextDay, onPreviousDay });
  const query = normalize(rawQuery.trim());
  const searching = query.length > 0;

  if (shownDate !== day.date) {
    setShownDate(day.date);
    setRawQuery("");
    setActiveSection(null);
    setOverrides({});
  }

  useEffect(() => {
    navigationRef.current = { onNextDay, onPreviousDay };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "ArrowLeft") {
        navigationRef.current.onPreviousDay?.();
      } else if (event.key === "ArrowRight") {
        navigationRef.current.onNextDay?.();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allSections = useMemo(() => (detail ? ABSENCE_SECTIONS.map((section) => ({ ...section, entries: detail[section.key] })).filter((section) => section.entries.length > 0) : []), [detail]);
  const totalPeople = allSections.reduce((total, section) => total + section.entries.length, 0);
  const filtered = useMemo(() => allSections
    .map((section) => ({ ...section, entries: searching ? section.entries.filter((person) => matches(person, query)) : section.entries }))
    .filter((section) => section.entries.length > 0), [allSections, query, searching]);
  const visible = activeSection ? filtered.filter((section) => section.key === activeSection) : filtered;
  const matchCount = filtered.reduce((total, section) => total + section.entries.length, 0);

  function isOpen(key: AbsenceSectionKey) {
    return searching || activeSection === key || (overrides[key] ?? OPEN_BY_DEFAULT.has(key));
  }

  function clearSearch() {
    setRawQuery("");
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && rawQuery) {
      event.stopPropagation();
      setRawQuery("");
    }
  }

  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Panel className="h-[92dvh] max-w-xl sm:h-[min(44rem,calc(100dvh-3rem))]" padded={false}>
        <Dialog.Header className="px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <Dialog.Title>{formatDateKeyForDisplay(day.date)}</Dialog.Title>
            <div className="flex items-center">
              <Button aria-label="Día anterior" disabled={!onPreviousDay} onClick={onPreviousDay} size="icon" variant="ghost"><ChevronLeft aria-hidden="true" className="size-5" /></Button>
              <Button aria-label="Día siguiente" disabled={!onNextDay} onClick={onNextDay} size="icon" variant="ghost"><ChevronRight aria-hidden="true" className="size-5" /></Button>
            </div>
          </div>
        </Dialog.Header>

        {!loading && !error && totalPeople > 0 ? (
          <div className="shrink-0 space-y-3 border-b border-zinc-200 px-5 pb-3 pt-3 sm:px-6">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                aria-label="Buscar persona"
                autoComplete="off"
                className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-10 text-base text-zinc-950 transition-colors [&::-webkit-search-cancel-button]:appearance-none hover:border-zinc-400 focus-visible:border-zinc-950 sm:text-sm"
                onChange={(event) => setRawQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por nombre o email…"
                ref={searchRef}
                type="search"
                value={rawQuery}
              />
              {rawQuery ? (
                <button aria-label="Borrar búsqueda" className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950" onClick={clearSearch} type="button"><X aria-hidden="true" className="size-4" /></button>
              ) : (
                <kbd aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-zinc-300 px-1.5 text-xs text-zinc-500 sm:block">/</kbd>
              )}
            </div>
            <div aria-label="Filtrar por sección" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap" role="group">
              {filtered.map((section) => {
                const pressed = activeSection === section.key;
                return (
                  <button
                    aria-pressed={pressed}
                    className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors ${pressed ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"}`}
                    key={section.key}
                    onClick={() => setActiveSection(pressed ? null : section.key)}
                    type="button"
                  >
                    <span aria-hidden="true" className={`size-2 rounded-full ${SECTION_STYLES[section.key].dot} ${pressed ? "ring-1 ring-white/70" : ""}`} />
                    {section.label}
                    <span className="tabular-nums opacity-80">{section.entries.length}</span>
                  </button>
                );
              })}
            </div>
            <p aria-live="polite" className={`text-xs text-zinc-600 ${searching ? "" : "sr-only"}`} role="status">{searching ? `${matchCount} de ${totalPeople} ${totalPeople === 1 ? "persona" : "personas"}` : ""}</p>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {loading ? <DayDetailSkeleton /> : error ? <ActionFeedback error={error} /> : totalPeople === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">Sin registros para este día.</p>
          ) : visible.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-700">Nadie coincide con «{rawQuery.trim()}».</p>
              <Button className="mt-3" onClick={clearSearch} size="sm" variant="secondary">Borrar búsqueda</Button>
            </div>
          ) : (
            visible.map((section) => {
              const open = isOpen(section.key);
              const panelId = `day-section-${section.key}`;
              const styles = SECTION_STYLES[section.key];
              const count = `${section.entries.length} ${section.entries.length === 1 ? "persona" : "personas"}`;
              const heading = (
                <>
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${styles.dot}`} />
                    <span className="text-sm font-semibold text-zinc-950">{section.label}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                    {count}
                    {searching || activeSection ? null : <ChevronRight aria-hidden="true" className={`size-4 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`} />}
                  </span>
                </>
              );
              return (
                <section aria-label={section.label} className="overflow-hidden rounded-xl border border-zinc-200" key={section.key}>
                  {searching || activeSection ? (
                    <div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${styles.soft}`}>{heading}</div>
                  ) : (
                    <button aria-controls={open ? panelId : undefined} aria-expanded={open} className={`flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:brightness-95 ${styles.soft}`} onClick={() => setOverrides((current) => ({ ...current, [section.key]: !open }))} type="button">{heading}</button>
                  )}
                  {open ? (
                    <ul className="grid gap-x-4 p-2 sm:grid-cols-2" id={panelId}>
                      {section.entries.map((entry, index) => (
                        <li className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-50" key={entry.userId ?? `${entry.userName}-${index}`}>
                          <GeneratedAvatar className="size-9 text-xs" name={entry.userName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950"><Highlight query={query} text={entry.userName} /></p>
                            {entry.userEmail ? <p className="truncate text-xs text-zinc-600"><Highlight query={query} text={entry.userEmail} /></p> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
