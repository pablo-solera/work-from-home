export type BadgeTone = "dark" | "neutral" | "remote" | "pending" | "info" | "success" | "danger";

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  dark: { badge: "bg-zinc-950 text-white", dot: "bg-white" },
  neutral: { badge: "bg-zinc-100 text-zinc-700", dot: "bg-zinc-500" },
  remote: { badge: "bg-indigo-50 text-indigo-800", dot: "bg-indigo-600" },
  pending: { badge: "bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  info: { badge: "bg-sky-50 text-sky-900", dot: "bg-sky-600" },
  success: { badge: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-600" },
  danger: { badge: "bg-red-50 text-red-800", dot: "bg-red-600" },
};

export function Badge({ children, className = "", tone = "neutral" }: { children: React.ReactNode; className?: string; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${tones[tone].badge} ${className}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${tones[tone].dot}`} />
      {children}
    </span>
  );
}
