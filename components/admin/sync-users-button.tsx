"use client";

import { useState, useTransition } from "react";
import { syncUsersAction } from "@/app/(dashboard)/admin/users/actions";
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

    </div>
  );
}
