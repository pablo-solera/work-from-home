export function PanelSkeleton({ label }: { label: string }) {
  return <div aria-label={label} className="h-96 animate-pulse rounded-2xl border border-zinc-200 bg-white motion-reduce:animate-none" role="status" />;
}
