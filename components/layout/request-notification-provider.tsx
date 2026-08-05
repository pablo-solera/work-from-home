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

    const events = new EventSource("/api/requests/events");
    const notify = (event: NotificationEvent) => {
      for (const listener of listenersRef.current) listener(event);
    };
    const handleReady = () => notify("ready");
    const handleChange = () => notify("requests-changed");
    events.addEventListener("ready", handleReady);
    events.addEventListener("requests-changed", handleChange);

    return () => {
      events.removeEventListener("ready", handleReady);
      events.removeEventListener("requests-changed", handleChange);
      events.close();
    };
  }, [hasSubscribers]);

  return <RequestNotificationContext.Provider value={{ subscribe }}>{children}</RequestNotificationContext.Provider>;
}

export function useRequestNotifications() {
  const context = useContext(RequestNotificationContext);
  if (!context) throw new Error("useRequestNotifications must be used within RequestNotificationProvider.");
  return context;
}
