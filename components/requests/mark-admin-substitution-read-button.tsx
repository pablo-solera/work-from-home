"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAdminSubstitutionAsReadAction } from "@/app/(dashboard)/requests/actions";
import { useErrorModal } from "@/components/common/error-modal-provider";

export function MarkAdminSubstitutionReadButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { showError } = useErrorModal();

  return <button aria-busy={pending} className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={() => startTransition(async () => { try { const formData = new FormData(); formData.append("id", requestId); const result = await markAdminSubstitutionAsReadAction(formData); if (!result.ok) { showError(result.error ?? "No se pudo marcar la sustitución como leída."); return; } router.refresh(); } catch (cause) { showError(cause instanceof Error ? cause.message : "No se pudo marcar la sustitución como leída."); } })} type="button">{pending ? "Marcando…" : "Marcar como leída"}</button>;
}
