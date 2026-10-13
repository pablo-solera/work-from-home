"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Toast = {
  id: number;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message }]);
  }, []);
  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-atomic="false" aria-live="polite" className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96" role="status">
        {toasts.map((toast) => <ToastItem dismissToast={dismissToast} key={toast.id} toast={toast} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ dismissToast, toast }: { dismissToast: (id: number) => void; toast: Toast }) {
  const timeoutRef = useRef<number | null>(null);
  const remainingRef = useRef(5000);
  const startedAtRef = useRef(0);

  useEffect(() => {
    function resumeTimer() {
      startedAtRef.current = Date.now();
      timeoutRef.current = window.setTimeout(() => dismissToast(toast.id), remainingRef.current);
    }
    resumeTimer();
    return () => { if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current); };
  }, [dismissToast, toast.id]);

  function pauseTimer() {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
  }

  function resumeTimer() {
    if (timeoutRef.current !== null) return;
    startedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => dismissToast(toast.id), remainingRef.current);
  }

  return <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) resumeTimer(); }} onFocusCapture={pauseTimer} onMouseEnter={pauseTimer} onMouseLeave={resumeTimer} className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg motion-reduce:transition-none"><span>{toast.message}</span><button aria-label="Cerrar notificación" className="min-h-11 min-w-11 cursor-pointer text-lg leading-none text-emerald-700 hover:text-emerald-950" onClick={() => dismissToast(toast.id)} type="button">×</button></div>;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
