"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Dialog } from "./dialog";

type ErrorModalContextValue = { showError: (message: string) => void };
const ErrorModalContext = createContext<ErrorModalContextValue | null>(null);

export function ErrorModalProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const showError = useCallback((error: string) => setMessage(error), []);

  return <ErrorModalContext.Provider value={{ showError }}>{children}{message ? <Dialog onDismiss={() => setMessage(null)}><Dialog.Panel className="max-w-md"><div className="flex items-start justify-between gap-4"><div><Dialog.Title>Se ha producido un error</Dialog.Title><p aria-live="assertive" className="mt-3 text-sm text-red-700">{message}</p></div><Dialog.Close onClick={() => setMessage(null)} /></div><div className="mt-6 flex justify-end"><button className="cursor-pointer rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" onClick={() => setMessage(null)} type="button">Aceptar</button></div></Dialog.Panel></Dialog> : null}</ErrorModalContext.Provider>;
}

export function useErrorModal() {
  const context = useContext(ErrorModalContext);
  return context ?? { showError: () => undefined };
}
