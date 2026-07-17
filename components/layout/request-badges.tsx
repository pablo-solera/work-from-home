"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type RequestBadgeSummary = {
  pendingRequestCount: number;
  unreadSubstitutionCount: number;
  revision: string | null;
};

const POLL_INTERVAL_MS = 20_000;

export function RequestBadges(initialSummary: RequestBadgeSummary) {
  const pathname = usePathname();
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const summaryRef = useRef(initialSummary);
  const requestRef = useRef<AbortController | null>(null);
  const refreshScheduledRef = useRef(false);
  const hasPolledRef = useRef(false);

  const fetchSummary = useCallback(async (refreshPage: boolean) => {
    if (document.visibilityState !== "visible" || requestRef.current) return;

    requestRef.current = new AbortController();
    try {
      const response = await fetch("/api/requests/summary", { cache: "no-store", signal: requestRef.current.signal });
      if (!response.ok) return;
      const next = await response.json() as RequestBadgeSummary;
      if (!Number.isInteger(next.pendingRequestCount) || !Number.isInteger(next.unreadSubstitutionCount)) return;

      const changed = hasPolledRef.current && next.revision !== summaryRef.current.revision;
      summaryRef.current = next;
      setSummary(next);
      hasPolledRef.current = true;

      if (refreshPage && changed && pathname === "/requests" && !refreshScheduledRef.current) {
        refreshScheduledRef.current = true;
        window.setTimeout(() => {
          refreshScheduledRef.current = false;
          router.refresh();
        }, 150);
      }
    } catch {
      // Keep the last known values while the API is temporarily unavailable.
    } finally {
      requestRef.current = null;
    }
  }, [pathname, router]);

  useEffect(() => {
    const poll = () => { void fetchSummary(true); };
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", poll);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", poll);
      requestRef.current?.abort();
    };
  }, [fetchSummary]);

  const accessibleSummary = `${summary.pendingRequestCount} solicitudes pendientes. ${summary.unreadSubstitutionCount} sustituciones nuevas.`;
  return <span aria-atomic="true" aria-label={accessibleSummary} className="ml-1 inline-flex items-center gap-0.5 align-top" aria-live="polite"><span aria-hidden="true">{summary.pendingRequestCount > 0 ? <span className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{summary.pendingRequestCount}</span> : null}{summary.unreadSubstitutionCount > 0 ? <span className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold leading-4 text-white">{summary.unreadSubstitutionCount}</span> : null}</span></span>;
}
