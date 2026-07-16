"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function RequestBadges({ pendingRequestCount: initialPending, unreadSubstitutionCount: initialUnread }: { pendingRequestCount: number; unreadSubstitutionCount: number }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ pending: initialPending, unread: initialUnread });

  useEffect(() => {
    let active = true;

    fetch("/api/requests/summary", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { pendingRequestCount?: number; unreadSubstitutionCount?: number }) => {
        if (active) {
          setCounts({ pending: data.pendingRequestCount ?? 0, unread: data.unreadSubstitutionCount ?? 0 });
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    function refreshCounts() {
      fetch("/api/requests/summary", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { pendingRequestCount?: number; unreadSubstitutionCount?: number }) => {
          setCounts({ pending: data.pendingRequestCount ?? 0, unread: data.unreadSubstitutionCount ?? 0 });
        })
        .catch(() => undefined);
    }

    window.addEventListener("request-counts-updated", refreshCounts);
    return () => window.removeEventListener("request-counts-updated", refreshCounts);
  }, []);

  return <span className="ml-1 inline-flex items-center gap-0.5 align-top" aria-label={`${counts.pending} solicitudes pendientes y ${counts.unread} sustituciones nuevas`}>{counts.pending > 0 ? <span aria-hidden="true" className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{counts.pending}</span> : null}{counts.unread > 0 ? <span aria-hidden="true" className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold leading-4 text-white">{counts.unread}</span> : null}</span>;
}
