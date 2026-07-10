"use client";

import { useActionState } from "react";
import { deleteUserAction } from "@/app/(dashboard)/admin/users/actions";
import { CloseIcon } from "@/components/icons/close-icon";
import { useModalDismiss } from "@/lib/hooks/use-modal-dismiss";
import { initialUserManagementState } from "@/lib/users/user-management-state";
import type { ManagedUser } from "./users-table";

type DeleteUserDialogProps = {
  currentUserId: string;
  onClose: () => void;
  user: ManagedUser;
};

export function DeleteUserDialog({ currentUserId, onClose, user }: DeleteUserDialogProps) {
  const dialogRef = useModalDismiss<HTMLElement>(onClose);
  const [state, action, pending] = useActionState(deleteUserAction, initialUserManagementState);
  const isCurrentUser = user.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4" onClick={onClose}>
      <section aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()} ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-red-600">Eliminar usuario</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">{user.name}</h2>
            <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
          </div>
          <button aria-label="Cerrar" className="inline-flex cursor-pointer items-center justify-center p-1.5 text-zinc-500 hover:text-zinc-950" onClick={onClose} type="button">
            <CloseIcon className="size-5" />
          </button>
        </div>

        <form action={action} className="mt-6 space-y-4">
          <input name="id" type="hidden" value={user.id} />
          <p className="text-sm text-zinc-700">Esta acción elimina el usuario y sus días de teletrabajo. Si es coordinador, sus empleados quedarán sin coordinador asignado.</p>
          {isCurrentUser ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">No puedes eliminar tu propia cuenta.</p> : null}
          {state.error ? (
            <p aria-live="polite" className="text-sm text-red-600">
              {state.error}
            </p>
          ) : null}
          {state.message ? (
            <p aria-live="polite" className="text-sm text-emerald-700">
              {state.message}
            </p>
          ) : null}
          <button className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60" disabled={pending || isCurrentUser}>
            {pending ? "Eliminando…" : "Eliminar usuario"}
          </button>
        </form>
      </section>
    </div>
  );
}
