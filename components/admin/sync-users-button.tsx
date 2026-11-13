"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { syncUsersAction } from "@/app/(dashboard)/admin/users/actions";
import { ActionFeedback } from "@/components/common/action-feedback";
import { Button } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { initialSyncUsersState, type SyncUsersState } from "@/lib/users/sync-state";

export function SyncUsersButton() {
  const [state, setState] = useState<SyncUsersState>(initialSyncUsersState);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSync() {
    setConfirming(false);
    startTransition(async () => {
      const result = await syncUsersAction();
      setState(result);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button disabled={pending} onClick={() => setConfirming(true)}>
        <RefreshCw aria-hidden="true" className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Sincronizando…" : "Sincronizar con TimerTask"}
      </Button>

      <ActionFeedback error={state.error} message={state.ok ? `Creados: ${state.created} · Desactivados: ${state.deactivated}` : null} />

      {confirming ? (
        <ConfirmDialog
          confirmLabel="Sincronizar"
          description="Los usuarios que ya no están activos se desactivarán y conservarán su historial."
          onClose={() => setConfirming(false)}
          onConfirm={handleSync}
          title="¿Sincronizar con TimerTask?"
        />
      ) : null}
    </div>
  );
}
