"use client";

import { useState, useTransition } from "react";
import { syncUsersAction } from "@/app/(dashboard)/admin/users/actions";
import { ActionFeedback } from "@/components/common/action-feedback";
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

      <ActionFeedback error={state.error} message={state.ok ? `Creados: ${state.created} · Borrados: ${state.deleted}` : null} />

    </div>
  );
}
