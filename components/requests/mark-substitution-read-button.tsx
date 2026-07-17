"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markSubstitutionAsReadAction } from "@/app/(dashboard)/requests/actions";

export function MarkSubstitutionReadButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markAsRead() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", requestId);
      await markSubstitutionAsReadAction(formData);
       router.refresh();
    });
  }

  return <button className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={markAsRead} type="button">{pending ? "Marcando…" : "Marcar como leída"}</button>;
}
