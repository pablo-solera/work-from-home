"use client";

import { useActionState, useEffect } from "react";
import { updateUserAction } from "@/app/(dashboard)/admin/users/actions";
import { Dialog } from "@/components/common/dialog";
import { fieldClasses } from "@/components/common/form-classes";
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
      <Dialog.Panel className="max-w-xl" padded={false}>
        <Dialog.Header className="px-5 pt-5 sm:px-6 sm:pt-6">
          <Dialog.Title>Editar usuario</Dialog.Title>
        </Dialog.Header>

        <form action={action} className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6">
            <input name="id" type="hidden" value={user.id} />

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium text-zinc-950">{user.name}</p>
              <p className="text-xs text-zinc-600">{user.email}</p>
              <p className="text-xs text-zinc-600">WD: {user.wdNumber ?? "—"}</p>
              <p className="mt-2 text-xs text-zinc-600">La identidad (nombre, email y WD) se gestiona en TimerTask.</p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-950">
              <p><strong>Rol:</strong> {user.role === "admin" ? "Admin" : user.role === "coordinator" ? "Coordinador" : "Empleado"}</p>
              <p className="mt-1"><strong>Coordinador:</strong> {user.coordinator?.name ?? "Sin coordinador"}</p>
              <p className="mt-2 text-xs text-sky-900">El rol y la jerarquía se gestionan en TimerTask y se sincronizan al iniciar sesión.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">Cupo de días de teletrabajo</span>
                <input
                  className={fieldClasses}
                  defaultValue={user.wfhDaysAllowance ?? ""}
                  min={0}
                  name="wfhDaysAllowance"
                  placeholder="Ej. 20"
                  step={1}
                  type="number"
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                <input className="size-4 accent-zinc-950" defaultChecked={user.hasWfh ?? false} name="hasWfh" type="checkbox" />
                <span>
                  <span className="block font-medium">Tiene teletrabajo</span>
                  <span className="text-xs text-zinc-600">Marca si el usuario tiene WFH.</span>
                </span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 sm:col-span-2">
                <input className="size-4 accent-zinc-950" defaultChecked={user.canEditAllWfh ?? false} name="canEditAllWfh" type="checkbox" />
                <span>
                  <span className="block font-medium">Cobertura de teletrabajo</span>
                  <span className="text-xs text-zinc-600">Permite editar los días de teletrabajo de cualquier persona, sin permisos de administración.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-zinc-200 px-5 py-4 sm:px-6">
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
