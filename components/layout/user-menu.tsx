"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/(dashboard)/actions";
import { GeneratedAvatar } from "@/components/common/generated-avatar";
import type { SessionUser } from "@/lib/auth/session";

const roleLabels: Record<SessionUser["role"], string> = {
  admin: "Admin",
  coordinator: "Coordinador",
  employee: "Empleado",
};

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative border-l border-zinc-200 pl-4" ref={menuRef}>
      <button
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-zinc-100"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <GeneratedAvatar name={user.name} />
        <span className="hidden sm:block">
          <span className="block text-sm font-medium text-zinc-950">{user.name}</span>
          <span className="block text-xs text-zinc-500">{roleLabels[user.role]}</span>
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          <div className="border-b border-zinc-100 px-4 py-3 sm:hidden">
            <p className="text-sm font-medium text-zinc-950">{user.name}</p>
            <p className="text-xs text-zinc-500">{roleLabels[user.role]}</p>
          </div>
          {user.role === "coordinator" ? (
            <Link className="block cursor-pointer px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950" href="/settings" onClick={() => setOpen(false)}>
              Configuración
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button className="w-full cursor-pointer px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
