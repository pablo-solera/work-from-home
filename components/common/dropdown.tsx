"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type DropdownOption = { hint?: string; label: string; value: string };

type DropdownProps = {
  "aria-label": string;
  className?: string;
  onChange: (value: string) => void;
  options: readonly DropdownOption[];
  placeholder?: string;
  searchable?: boolean;
  value: string;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function Dropdown({ "aria-label": ariaLabel, className = "", onChange, options, placeholder = "Seleccionar", searchable = false, value }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value);
  const longestLabel = useMemo(() => options.reduce((longest, option) => (option.label.length > longest.length ? option.label : longest), placeholder), [options, placeholder]);
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((option) => normalize(`${option.label} ${option.hint ?? ""}`).includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") setOpen(true);
      return;
    }
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
    items[next]?.focus();
  }

  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => { if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={handleKeyDown}
      ref={rootRef}
    >
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${ariaLabel}: ${current?.label ?? placeholder}`}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-left text-sm text-zinc-950 transition-colors hover:border-zinc-400"
        onClick={() => setOpen((previous) => !previous)}
        ref={triggerRef}
        title={current?.label}
        type="button"
      >
        {/* The longest label is rendered invisibly so the trigger keeps a stable width. */}
        <span className="grid min-w-0 flex-1">
          <span className={`col-start-1 row-start-1 truncate ${current ? "" : "text-zinc-500"}`}>{current?.label ?? placeholder}</span>
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap">{longestLabel}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="wfh-popover absolute z-40 mt-2 w-full min-w-48 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-dialog">
          {searchable ? (
            <div className="relative mb-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                aria-label="Buscar opción"
                autoComplete="off"
                autoFocus
                className="min-h-10 w-full rounded-lg bg-zinc-100 pl-8 pr-2 text-base text-zinc-950 sm:text-sm"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar…"
                value={query}
              />
            </div>
          ) : null}
          <ul aria-label={ariaLabel} className="max-h-64 overflow-auto overscroll-contain" id={listId} role="listbox">
            {visible.length === 0 ? <li className="px-3 py-2 text-sm text-zinc-600" role="presentation">Sin resultados</li> : null}
            {visible.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    aria-selected={selected}
                    className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100"
                    onClick={() => choose(option.value)}
                    role="option"
                    type="button"
                  >
                    <span className="min-w-0 truncate">
                      {option.label}
                      {option.hint ? <span className="ml-2 text-xs text-zinc-600">{option.hint}</span> : null}
                    </span>
                    {selected ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-zinc-950" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
