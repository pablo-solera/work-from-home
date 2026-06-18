"use client";

import { useActionState, useState } from "react";
import { changeUserPasswordAction } from "@/app/(dashboard)/admin/users/actions";
import { initialUserManagementState } from "@/lib/users/user-management-state";
import type { ManagedUser } from "./users-table";

type UserPasswordModalProps = {
  onClose: () => void;
  user: ManagedUser;
};

export function UserPasswordModal({ onClose, user }: UserPasswordModalProps) {
  const [passwordMode, setPasswordMode] = useState<"generate" | "manual">("generate");
  const [state, action, pending] = useActionState(changeUserPasswordAction, initialUserManagementState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4" onClick={onClose}>
      <section aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Contraseña</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">Cambiar contraseña</h2>
            <p className="mt-1 text-sm text-zinc-600">{user.name} · {user.email}</p>
          </div>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <form action={action} className="mt-6 space-y-4">
          <input name="id" type="hidden" value={user.id} />
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-medium text-zinc-700">Nueva contraseña</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input checked={passwordMode === "generate"} name="passwordMode" onChange={() => setPasswordMode("generate")} type="radio" value="generate" />
                Generar temporal
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input checked={passwordMode === "manual"} name="passwordMode" onChange={() => setPasswordMode("manual")} type="radio" value="manual" />
                Escribir manualmente
              </label>
            </div>
            {passwordMode === "manual" ? <input className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" minLength={8} name="password" placeholder="Mínimo 8 caracteres" type="password" /> : null}
          </div>

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
          {state.generatedPassword ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-zinc-700">Contraseña temporal: <span className="font-mono font-semibold">{state.generatedPassword}</span></p> : null}

          <div className="flex justify-end">
            <button className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60" disabled={pending}>
              {pending ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
