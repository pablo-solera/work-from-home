"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAdminSubstitutionAsReadAction } from "@/app/(dashboard)/requests/actions";

export function MarkAdminSubstitutionReadButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return <button aria-busy={pending} className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={() => startTransition(async () => { const formData = new FormData(); formData.append("id", requestId); await markAdminSubstitutionAsReadAction(formData); router.refresh(); })} type="button">{pending ? "Marcando…" : "Marcar como leída"}</button>;
}
