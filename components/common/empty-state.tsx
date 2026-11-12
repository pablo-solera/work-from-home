import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  action?: React.ReactNode;
  className?: string;
  description?: string;
  icon: LucideIcon;
  title: string;
};

export function EmptyState({ action, className = "", description, icon: Icon, title }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`}>
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-600">
        <Icon className="size-6" />
      </span>
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      {description ? <p className="max-w-sm text-sm text-zinc-600">{description}</p> : null}
      {action}
    </div>
  );
}
