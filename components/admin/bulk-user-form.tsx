"use client";

import { useActionState } from "react";
import { createUsersBulkAction } from "@/app/(dashboard)/admin/users/actions";
import { initialBulkUserFormState } from "@/lib/users/bulk-user-form-state";
import { UserCreationResult } from "./user-creation-result";

export function BulkUserForm() {
  const [state, action, pending] = useActionState(createUsersBulkAction, initialBulkUserFormState);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Correos</span>
          <textarea className="min-h-56 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="emails" placeholder={"ana@empresa.com\nluis@empresa.com"} required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Rol</span>
          <select className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="role" defaultValue="employee">
            <option value="employee">Employee</option>
            <option value="coordinator">Coordinador</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Email del coordinador</span>
          <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="coordinatorEmail" placeholder="coordinador@empresa.com" type="email" />
          <span className="text-xs text-zinc-500">Opcional. Solo se aplica al crear employees.</span>
        </label>
        <button className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60" disabled={pending}>
          {pending ? "Creando..." : "Crear usuarios"}
        </button>
      </form>
      <UserCreationResult result={state} />
    </div>
  );
}
