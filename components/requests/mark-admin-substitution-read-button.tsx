"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAdminSubstitutionAsReadAction } from "@/app/(dashboard)/requests/actions";
import { ActionFeedback } from "@/components/common/action-feedback";

export function MarkAdminSubstitutionReadButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return <span className="inline-flex flex-wrap items-center gap-2"><button aria-busy={pending} className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={() => { setError(null); startTransition(async () => { try { const formData = new FormData(); formData.append("id", requestId); const result = await markAdminSubstitutionAsReadAction(formData); if (!result.ok) { setError(result.error ?? "No se pudo marcar la sustitución como leída."); return; } router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo marcar la sustitución como leída."); } }); }} type="button">{pending ? "Marcando…" : "Marcar como leída"}</button><ActionFeedback error={error} /></span>;
}
