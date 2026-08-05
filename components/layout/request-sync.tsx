"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useRequestNotifications } from "./request-notification-provider";

const SYNC_PATHS = new Set(["/calendar", "/requests", "/team"]);

export function RequestSync() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const refreshScheduled = useRef(false);
  const refreshPending = useRef(false);
  const { subscribe } = useRequestNotifications();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (!SYNC_PATHS.has(pathnameRef.current)) return;
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

    const unsubscribe = subscribe((event) => {
      if (event === "requests-changed") scheduleRefresh();
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && refreshPending.current) scheduleRefresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, subscribe]);

  return null;
}
