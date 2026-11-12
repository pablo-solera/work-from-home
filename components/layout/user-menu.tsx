"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/(dashboard)/actions";
import { GeneratedAvatar } from "@/components/common/generated-avatar";
import type { SessionUser } from "@/lib/auth/session";

const roleLabels: Record<SessionUser["role"], string> = {
  admin: "Administrador",
  coordinator: "Coordinador",
  employee: "Empleado",
};

const itemClasses = "flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100";

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === "Tab") {
        setOpen(false);
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
      const list = items();
      if (list.length === 0) return;
      event.preventDefault();
      const current = list.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : event.key === "ArrowDown" ? (current + 1) % list.length : (current - 1 + list.length) % list.length;
      list[next].focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative border-zinc-200 md:border-l md:pl-4" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menú de usuario: ${user.name}`}
        className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-zinc-100"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <GeneratedAvatar name={user.name} />
        <span className="hidden lg:block">
          <span className="block text-sm font-medium text-zinc-950">{user.name}</span>
          <span className="block text-xs text-zinc-600">{roleLabels[user.role]}</span>
        </span>
      </button>

      {open ? (
        <div aria-label="Cuenta" className="wfh-popover absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-dialog" role="menu">
          <div className="border-b border-zinc-100 px-4 py-3" role="presentation">
            <p className="truncate text-sm font-medium text-zinc-950">{user.name}</p>
            <p className="text-xs text-zinc-600">{roleLabels[user.role]}</p>
          </div>
          {user.role === "coordinator" ? (
            <Link className={itemClasses} href="/settings" onClick={() => setOpen(false)} role="menuitem">
              <Settings aria-hidden="true" className="size-4 shrink-0" />
              Configuración
            </Link>
          ) : null}
          <form action={logoutAction} role="none">
            <button className={itemClasses} role="menuitem" type="submit">
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
