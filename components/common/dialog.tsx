"use client";

import { X } from "lucide-react";
import { createContext, useContext, useId, useMemo } from "react";
import { useModalDismiss } from "@/lib/hooks/use-modal-dismiss";
import { Button } from "./button";

type DialogContextValue = { onDismiss: () => void; titleId: string };
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog components must be used inside Dialog");
  return context;
}

function DialogRoot({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const titleId = useId();
  const contextValue = useMemo(() => ({ onDismiss, titleId }), [onDismiss, titleId]);
  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onDismiss();
  }
  return (
    <DialogContext.Provider value={contextValue}>
      <div className="wfh-overlay fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-zinc-950/50 sm:items-center sm:px-4 sm:py-6" onClick={handleBackdropClick}>
        {children}
      </div>
    </DialogContext.Provider>
  );
}

type DialogPanelProps = {
  children: React.ReactNode;
  className?: string;
  /** Use `false` to structure the panel yourself with Dialog.Header, Dialog.Body and Dialog.Footer. */
  padded?: boolean;
};

function DialogPanel({ children, className = "max-w-lg", padded = true }: DialogPanelProps) {
  const { onDismiss, titleId } = useDialogContext();
  const panelRef = useModalDismiss<HTMLElement>(onDismiss);
  const layout = padded ? "overflow-y-auto overscroll-contain p-5 sm:p-6" : "overflow-hidden";

  return (
    <section aria-labelledby={titleId} aria-modal="true" className={`wfh-dialog flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-dialog focus-visible:outline-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl ${layout} ${className}`} onClick={(event) => event.stopPropagation()} ref={panelRef} role="dialog" tabIndex={-1}>
      {children}
    </section>
  );
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  const { titleId } = useDialogContext();
  return <h2 className="text-xl font-semibold text-zinc-950" id={titleId}>{children}</h2>;
}

function DialogClose({ onClick }: { onClick?: () => void }) {
  const { onDismiss } = useDialogContext();
  return <Button aria-label="Cerrar" className="-mr-2 -mt-1.5 rounded-full" onClick={onClick ?? onDismiss} size="icon" variant="ghost"><X aria-hidden="true" className="size-5" /></Button>;
}

function DialogHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex shrink-0 items-start justify-between gap-4 ${className}`}>{children}<DialogClose /></div>;
}

function DialogBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

export const Dialog = Object.assign(DialogRoot, {
  Actions: DialogActions,
  Body: DialogBody,
  Close: DialogClose,
  Header: DialogHeader,
  Panel: DialogPanel,
  Title: DialogTitle,
});
