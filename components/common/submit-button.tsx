"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses } from "./button";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  variant?: "danger" | "primary" | "secondary";
};

export function SubmitButton({ children, className = "", pendingLabel = "Guardando…", variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return <button aria-busy={pending} className={buttonClasses(variant, "md", className)} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}
