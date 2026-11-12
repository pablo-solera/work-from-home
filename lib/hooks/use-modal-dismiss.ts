"use client";

import { useEffect, useRef } from "react";

// Open dialogs, topmost last. Only the topmost one reacts to Escape and Tab,
// so a dialog opened on top of another (e.g. an error) closes alone.
const openDialogs: HTMLElement[] = [];

/**
 * Accessibility helpers for modal dialogs:
 * - closes on Escape (topmost dialog only)
 * - moves focus into the dialog on open and traps Tab inside it
 * - locks page scroll while any dialog is open
 * - restores focus to the previously focused element on close
 *
 * Attach the returned ref to the dialog container element.
 */
export function useModalDismiss<T extends HTMLElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose without re-running the dismiss effect.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    openDialogs.push(dialog);
    document.body.classList.add("overflow-hidden");
    dialog.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(dialog!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog!.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = openDialogs.indexOf(dialog);
      if (index !== -1) openDialogs.splice(index, 1);
      if (openDialogs.length === 0) document.body.classList.remove("overflow-hidden");
      previouslyFocused?.focus?.();
    };
  }, []);

  return dialogRef;
}
