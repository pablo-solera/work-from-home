"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/common/button";

/** Main navigation: inline on desktop, a dropdown panel behind a menu button on small screens. */
export function AppNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navId = useId();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        aria-controls={navId}
        aria-expanded={open}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className={`${buttonClasses("ghost", "icon")} order-last md:hidden`}
        onClick={() => setOpen((current) => !current)}
        ref={toggleRef}
        type="button"
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
      </button>
      <nav
        aria-label="Navegación principal"
        className={`${open ? "wfh-popover absolute inset-x-0 top-full flex flex-col gap-1 border-b border-zinc-200 bg-white p-3 shadow-panel" : "hidden"} md:static md:ml-auto md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
        id={navId}
        onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}
      >
        {children}
      </nav>
    </>
  );
}
