"use client";

import { Button } from "./button";
import { Dialog } from "./dialog";

type ConfirmDialogProps = {
  confirmLabel: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  tone?: "danger" | "primary";
};

export function ConfirmDialog({ confirmLabel, description, onClose, onConfirm, title, tone = "primary" }: ConfirmDialogProps) {
  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Panel className="max-w-sm">
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">Cancelar</Button>
          <Button onClick={onConfirm} variant={tone}>{confirmLabel}</Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
