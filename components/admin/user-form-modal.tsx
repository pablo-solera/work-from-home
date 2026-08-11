"use client";

import { useActionState, useEffect } from "react";
import { updateUserAction } from "@/app/(dashboard)/admin/users/actions";
import { Dialog } from "@/components/common/dialog";
import { useToast } from "@/components/common/toast-provider";
import { ActionFeedback } from "@/components/common/action-feedback";
import { SubmitButton } from "@/components/common/submit-button";
import { initialUserManagementState } from "@/lib/users/user-management-state";
import type { ManagedUser } from "./users-table";

type UserFormModalProps = {
  onClose: () => void;
  user: ManagedUser;
};

export function UserFormModal({ onClose, user }: UserFormModalProps) {
  const { showToast } = useToast();
  const [state, action] = useActionState(async (previousState: typeof initialUserManagementState, formData: FormData) => {
    const result = await updateUserAction(previousState, formData);
    if (result.ok) {
      showToast(result.message ?? "Cambios guardados correctamente.");
    }
    return result;
  }, initialUserManagementState);
  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [state.ok, onClose]);

  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Panel className="flex max-h-[90dvh] max-w-xl flex-col">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Gestión de usuarios</p>
            <Dialog.Title>Editar usuario</Dialog.Title>
          </div>
          <Dialog.Close onClick={onClose} />
        </div>

        <form action={action} className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
            <input name="id" type="hidden" value={user.id} />

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium text-zinc-950">{user.name}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
              <p className="text-xs text-zinc-500">WD: {user.wdNumber ?? "—"}</p>
              <p className="mt-2 text-xs text-zinc-500">La identidad (nombre, email y WD) se gestiona en TimerTask.</p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              <p><strong>Rol:</strong> {user.role === "admin" ? "Admin" : user.role === "coordinator" ? "Coordinador" : "Empleado"}</p>
              <p className="mt-1"><strong>Coordinador:</strong> {user.coordinator?.name ?? "Sin coordinador"}</p>
              <p className="mt-2 text-xs text-blue-700">El rol y la jerarquía se gestionan en TimerTask y se sincronizan al iniciar sesión.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">Cupo de días de teletrabajo</span>
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
                  defaultValue={user.wfhDaysAllowance ?? ""}
                  min={0}
                  name="wfhDaysAllowance"
                  placeholder="Ej. 20"
                  step={1}
                  type="number"
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                <input className="size-4 rounded border-zinc-300" defaultChecked={user.hasWfh ?? false} name="hasWfh" type="checkbox" />
                <span>
                  <span className="block font-medium">Tiene teletrabajo</span>
                  <span className="text-xs text-zinc-500">Marca si el usuario tiene WFH.</span>
                </span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:col-span-2">
                <input className="size-4 rounded border-zinc-300" defaultChecked={user.canEditAllWfh ?? false} name="canEditAllWfh" type="checkbox" />
                <span>
                  <span className="block font-medium">Cobertura de teletrabajo</span>
                  <span className="text-xs text-zinc-500">Permite editar los días de teletrabajo de cualquier persona, sin permisos de administración.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="shrink-0 space-y-4 border-t border-zinc-200 pt-4">
            <ActionFeedback error={state.error} message={state.message} />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
            </div>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
