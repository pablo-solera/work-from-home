"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

type ErrorModalContextValue = { showError: (message: string) => void };
const ErrorModalContext = createContext<ErrorModalContextValue | null>(null);

export function ErrorModalProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const showError = useCallback((error: string) => setMessage(error), []);
  const value = useMemo(() => ({ showError }), [showError]);

  return (
    <ErrorModalContext.Provider value={value}>
      {children}
      {message ? (
        <Dialog onDismiss={() => setMessage(null)}>
          <Dialog.Panel className="max-w-md">
            <Dialog.Header>
              <Dialog.Title>Se ha producido un error</Dialog.Title>
            </Dialog.Header>
            <p aria-live="assertive" className="mt-3 text-sm text-red-700">{message}</p>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setMessage(null)}>Aceptar</Button>
            </div>
          </Dialog.Panel>
        </Dialog>
      ) : null}
    </ErrorModalContext.Provider>
  );
}

export function useErrorModal() {
  const context = useContext(ErrorModalContext);
  return context ?? { showError: () => undefined };
}
