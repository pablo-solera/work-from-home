"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastTone = "error" | "info" | "success";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

const TONES = {
  error: { Icon: CircleAlert, box: "border-red-200 bg-red-50 text-red-900", icon: "text-red-700", close: "text-red-800 hover:bg-red-100" },
  info: { Icon: Info, box: "border-sky-200 bg-sky-50 text-sky-950", icon: "text-sky-700", close: "text-sky-900 hover:bg-sky-100" },
  success: { Icon: CircleCheck, box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "text-emerald-700", close: "text-emerald-900 hover:bg-emerald-100" },
} as const;

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
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

  const { Icon, box, close, icon } = TONES[toast.tone];

  return (
    <div
      className={`wfh-toast pointer-events-auto flex w-full items-center gap-3 rounded-xl border py-2 pl-4 pr-2 text-sm font-medium shadow-dialog ${box}`}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) resumeTimer(); }}
      onFocusCapture={pauseTimer}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      <Icon aria-hidden="true" className={`size-5 shrink-0 ${icon}`} />
      <span className="flex-1">{toast.message}</span>
      <button aria-label="Cerrar notificación" className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors ${close}`} onClick={() => dismissToast(toast.id)} type="button"><X aria-hidden="true" className="size-4" /></button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
