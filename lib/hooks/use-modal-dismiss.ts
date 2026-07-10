"use client";

import { useEffect, useRef } from "react";

/**
 * Accessibility helpers for modal dialogs:
 * - closes on Escape
 * - moves focus into the dialog on open
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
    const previouslyFocused = document.activeElement as HTMLElement | null;

    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return dialogRef;
}
