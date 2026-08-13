"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type NotificationEvent = "ready" | "requests-changed";
type Listener = (event: NotificationEvent) => void;
type NotificationContextValue = { subscribe: (listener: Listener) => () => void };

const RequestNotificationContext = createContext<NotificationContextValue | null>(null);

export function RequestNotificationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const listenersRef = useRef(new Set<Listener>());
  const [hasSubscribers, setHasSubscribers] = useState(false);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    setHasSubscribers(true);

    return () => {
      listenersRef.current.delete(listener);
      setHasSubscribers(listenersRef.current.size > 0);
    };
  }, []);

  useEffect(() => {
    if (!hasSubscribers) return;

    let events: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelay = 1000;
    const notify = (event: NotificationEvent) => {
      for (const listener of listenersRef.current) listener(event);
    };
    const handleReady = () => notify("ready");
    const handleChange = () => notify("requests-changed");
    const connect = () => {
      if (document.visibilityState !== "visible") return;
      events?.close();
      events = new EventSource("/api/requests/events");
      events.addEventListener("ready", handleReady);
      events.addEventListener("requests-changed", handleChange);
      events.onopen = () => { reconnectDelay = 1000; };
      events.onerror = () => {
        events?.close();
        if (reconnectTimer === null) {
          reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
      };
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") connect();
    };
    const handlePageShow = () => connect();
    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      events?.removeEventListener("ready", handleReady);
      events?.removeEventListener("requests-changed", handleChange);
      events?.close();
    };
  }, [hasSubscribers]);

  return <RequestNotificationContext.Provider value={{ subscribe }}>{children}</RequestNotificationContext.Provider>;
}

export function useRequestNotifications() {
  const context = useContext(RequestNotificationContext);
  if (!context) throw new Error("useRequestNotifications must be used within RequestNotificationProvider.");
  return context;
}
