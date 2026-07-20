"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const SYNC_PATHS = new Set(["/calendar", "/requests", "/team"]);

export function EmployeeRequestSync() {
  const pathname = usePathname();
  const router = useRouter();
  const refreshScheduled = useRef(false);
  const refreshPending = useRef(false);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (!SYNC_PATHS.has(pathname)) return;
      if (document.visibilityState !== "visible") {
        refreshPending.current = true;
        return;
      }
      if (refreshScheduled.current) return;

      refreshScheduled.current = true;
      window.setTimeout(() => {
        refreshScheduled.current = false;
        refreshPending.current = false;
        router.refresh();
      }, 150);
    };

    const source = new EventSource("/api/requests/events");
    source.addEventListener("ready", scheduleRefresh);
    source.addEventListener("requests-changed", scheduleRefresh);

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && refreshPending.current) scheduleRefresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      source.close();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, router]);

  return null;
}
