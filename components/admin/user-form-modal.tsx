"use client";

import { useActionState, useState } from "react";
import { createUserAction, updateUserAction } from "@/app/(dashboard)/admin/users/actions";
import { initialUserManagementState } from "@/lib/users/user-management-state";
import type { ManagedUser, UserCoordinatorOption } from "./users-table";

type UserFormModalProps = {
  coordinators: UserCoordinatorOption[];
  currentUserId: string;
  onClose: () => void;
  user?: ManagedUser;
};

const roleLabels: Record<ManagedUser["role"], string> = {
  admin: "Admin",
  coordinator: "Coordinador",
  employee: "Employee",
};

export function UserFormModal({ coordinators, currentUserId, onClose, user }: UserFormModalProps) {
  const isEditing = Boolean(user);
  const isCurrentUser = user?.id === currentUserId;
  const [role, setRole] = useState<ManagedUser["role"]>(user?.role ?? "employee");
  const [passwordMode, setPasswordMode] = useState<"generate" | "manual">("generate");
  const [state, action, pending] = useActionState(isEditing ? updateUserAction : createUserAction, initialUserManagementState);
  const availableCoordinators = coordinators.filter((coordinator) => coordinator.id !== user?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4" onClick={onClose}>
      <section aria-modal="true" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Gestión de usuarios</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">{isEditing ? "Editar usuario" : "Crear usuario"}</h2>
          </div>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <form action={action} className="mt-6 space-y-4">
          {user ? <input name="id" type="hidden" value={user.id} /> : null}
          {isCurrentUser ? <input name="role" type="hidden" value="admin" /> : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Nombre</span>
            <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" defaultValue={user?.name} name="name" required />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" defaultValue={user?.email} name="email" required type="email" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Rol</span>
            <select
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950 disabled:bg-zinc-100 disabled:text-zinc-500"
              defaultValue={user?.role ?? "employee"}
              disabled={isCurrentUser}
              name="role"
              onChange={(event) => setRole(event.target.value as ManagedUser["role"])}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {isCurrentUser ? <span className="text-xs text-zinc-500">No puedes quitarte a ti mismo el rol admin.</span> : null}
          </label>

          {role === "employee" ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">Coordinador</span>
              <select className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950" defaultValue={user?.coordinatorId ?? ""} name="coordinatorId">
                <option value="">Sin coordinador</option>
                {availableCoordinators.map((coordinator) => (
                  <option key={coordinator.id} value={coordinator.id}>
                    {coordinator.name} ({coordinator.email})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input name="coordinatorId" type="hidden" value="" />
          )}

          {isEditing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">WD</span>
                <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" defaultValue={user?.wdNumber ?? ""} name="wdNumber" placeholder="Ej. 100164" />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                <input className="size-4 rounded border-zinc-300" defaultChecked={user?.hasWfh ?? false} name="hasWfh" type="checkbox" />
                <span>
                  <span className="block font-medium">Tiene teletrabajo</span>
                  <span className="text-xs text-zinc-500">Marca si el usuario tiene WFH.</span>
                </span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:col-span-2">
                <input className="size-4 rounded border-zinc-300" defaultChecked={user?.canEditAllWfh ?? false} name="canEditAllWfh" type="checkbox" />
                <span>
                  <span className="block font-medium">Cobertura de teletrabajo</span>
                  <span className="text-xs text-zinc-500">Permite editar los días de teletrabajo de cualquier persona, sin permisos de administración.</span>
                </span>
              </label>
            </div>
          ) : null}

          {!isEditing ? (
            <div className="rounded-xl border border-zinc-200 p-4">
              <p className="text-sm font-medium text-zinc-700">Contraseña inicial</p>
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
          ) : null}

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
          {state.generatedPassword ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-zinc-700">Contraseña temporal: <span className="font-mono font-semibold">{state.generatedPassword}</span></p> : null}

          <button className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60" disabled={pending}>
            {pending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear usuario"}
          </button>
        </form>
      </section>
    </div>
  );
}
