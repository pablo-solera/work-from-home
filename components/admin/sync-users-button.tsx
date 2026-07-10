"use client";

import { useState, useTransition } from "react";
import { syncUsersAction } from "@/app/(dashboard)/admin/users/actions";
import { buildPasswordsCsv } from "@/lib/users/passwords-csv";
import { initialSyncUsersState, type SyncUsersState } from "@/lib/users/sync-state";

export function SyncUsersButton() {
  const [state, setState] = useState<SyncUsersState>(initialSyncUsersState);
  const [pending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncUsersAction();
      setState(result);
    });
  }

  function handleDownloadCsv() {
    if (!state.passwords || state.passwords.length === 0) {
      return;
    }

    const blob = new Blob([buildPasswordsCsv(state.passwords)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contrasenas-temporales.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const hasPasswords = Boolean(state.passwords && state.passwords.length > 0);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="cursor-pointer rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        disabled={pending}
        onClick={handleSync}
        type="button"
      >
        {pending ? "Sincronizando…" : "Sincronizar con TimerTask"}
      </button>

      {state.error ? (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p aria-live="polite" className="text-sm text-zinc-600">
          Creados: {state.created} · Borrados: {state.deleted}
        </p>
      ) : null}

      {hasPasswords ? (
        <button className="cursor-pointer text-sm font-medium text-blue-700 underline hover:text-blue-800" onClick={handleDownloadCsv} type="button">
          Descargar contraseñas temporales ({state.passwords?.length})
        </button>
      ) : null}
    </div>
  );
}
