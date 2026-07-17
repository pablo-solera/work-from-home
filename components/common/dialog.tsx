"use client";

import { createContext, useContext, useId } from "react";
import { CloseIcon } from "@/components/icons/close-icon";
import { useModalDismiss } from "@/lib/hooks/use-modal-dismiss";

type DialogContextValue = { onDismiss: () => void; titleId: string };
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog components must be used inside Dialog");
  return context;
}

function DialogRoot({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const titleId = useId();
  return (
    <DialogContext.Provider value={{ onDismiss, titleId }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4" onClick={onDismiss}>
        {children}
      </div>
    </DialogContext.Provider>
  );
}

function DialogPanel({ children, className = "max-w-lg" }: { children: React.ReactNode; className?: string }) {
  const { onDismiss, titleId } = useDialogContext();
  const panelRef = useModalDismiss<HTMLElement>(onDismiss);

  return <section aria-labelledby={titleId} aria-modal="true" className={`w-full rounded-2xl bg-white p-6 shadow-xl ${className}`} onClick={(event) => event.stopPropagation()} ref={panelRef} role="dialog" tabIndex={-1}>{children}</section>;
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  const { titleId } = useDialogContext();
  return <h2 className="mt-1 text-xl font-semibold text-zinc-950" id={titleId}>{children}</h2>;
}

function DialogClose({ onClick }: { onClick: () => void }) {
  return <button aria-label="Cerrar" className="inline-flex cursor-pointer items-center justify-center p-1.5 text-zinc-500 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" onClick={onClick} type="button"><CloseIcon className="size-5" /></button>;
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
  Panel: DialogPanel,
  Title: DialogTitle,
});
