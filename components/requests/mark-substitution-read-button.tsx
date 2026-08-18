"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markSubstitutionAsReadAction } from "@/app/(dashboard)/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";

export function MarkSubstitutionReadButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function markAsRead() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", requestId);
        const result = await markSubstitutionAsReadAction(formData);
        if (!result.ok) {
          const message = result.error ?? "No se pudo marcar la sustitución como leída.";
          setError(message);
          return;
        }
        router.refresh();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "No se pudo marcar la sustitución como leída.";
        setError(message);
      }
    });
  }

  return <span className="inline-flex flex-wrap items-center gap-2"><button aria-busy={pending} className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={markAsRead} type="button">{pending ? "Marcando…" : "Marcar como leída"}</button><ActionFeedback error={error} /></span>;
}
