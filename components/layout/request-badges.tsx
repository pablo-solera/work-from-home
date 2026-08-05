"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRequestNotifications } from "./request-notification-provider";

type RequestBadgeSummary = {
  actionableRequestCount: number;
  informationalRequestCount: number;
  revision: string | null;
};

const POLL_INTERVAL_MS = 120_000;

export function RequestBadges(initialSummary: RequestBadgeSummary) {
  const pathname = usePathname();
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const summaryRef = useRef(initialSummary);
  const requestRef = useRef<AbortController | null>(null);
  const refreshScheduledRef = useRef(false);
  const { subscribe } = useRequestNotifications();

  useEffect(() => {
    if (initialSummary.revision === summaryRef.current.revision
      && initialSummary.actionableRequestCount === summaryRef.current.actionableRequestCount
      && initialSummary.informationalRequestCount === summaryRef.current.informationalRequestCount) return;

    summaryRef.current = initialSummary;
    setSummary(initialSummary);
  }, [initialSummary]);

  const fetchSummary = useCallback(async (refreshPage: boolean) => {
    if (document.visibilityState !== "visible" || requestRef.current) return;

    requestRef.current = new AbortController();
    try {
      const response = await fetch("/api/requests/summary", { cache: "no-store", signal: requestRef.current.signal });
      if (!response.ok) return;
      const next = await response.json() as RequestBadgeSummary;
       if (!Number.isInteger(next.actionableRequestCount) || !Number.isInteger(next.informationalRequestCount)) return;

      const changed = next.revision !== summaryRef.current.revision;
      summaryRef.current = next;
      setSummary(next);

        if (refreshPage && changed && pathname === "/admin/requests" && !refreshScheduledRef.current) {
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
    const unsubscribe = subscribe((event) => {
      if (event === "ready" || event === "requests-changed") poll();
    });
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", poll);

    return () => {
      window.clearInterval(interval);
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", poll);
      requestRef.current?.abort();
    };
  }, [fetchSummary, subscribe]);

  const accessibleSummary = `${summary.actionableRequestCount} solicitudes pendientes que requieren acción. ${summary.informationalRequestCount} avisos informativos.`;
  return <span aria-atomic="true" aria-label={accessibleSummary} className="ml-1 inline-flex items-center gap-0.5 align-top" aria-live="polite"><span aria-hidden="true">{summary.actionableRequestCount > 0 ? <span className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{summary.actionableRequestCount}</span> : null}{summary.informationalRequestCount > 0 ? <span className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold leading-4 text-white">{summary.informationalRequestCount}</span> : null}</span></span>;
}
