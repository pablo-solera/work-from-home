"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  variant?: "danger" | "primary" | "secondary";
};

const variants = {
  danger: "wfh-button-danger",
  primary: "wfh-button-primary",
  secondary: "min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950",
} as const;

export function SubmitButton({ children, className = "", pendingLabel = "Guardando…", variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return <button aria-busy={pending} className={`cursor-pointer focus-visible:outline-none ${variants[variant]} ${className}`} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}
