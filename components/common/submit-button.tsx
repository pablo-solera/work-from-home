"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  variant?: "danger" | "primary" | "secondary";
};

const variants = {
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-700",
  primary: "bg-zinc-950 text-white hover:bg-zinc-800 focus-visible:ring-zinc-950",
  secondary: "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 focus-visible:ring-zinc-950",
} as const;

export function SubmitButton({ children, className = "", pendingLabel = "Guardando…", variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return <button aria-busy={pending} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}
