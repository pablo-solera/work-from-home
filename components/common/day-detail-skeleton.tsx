import { Skeleton } from "@/components/common/skeleton";

export function DayDetailSkeleton() {
  return <div aria-label="Cargando detalle del día" className="space-y-3" role="status">{Array.from({ length: 2 }, (_, index) => <div className="flex h-14 items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4" key={`detail-${index}`}><div className="flex items-center gap-3"><Skeleton className="size-4 rounded-sm" /><Skeleton className="h-5 w-32" /></div><Skeleton className="h-4 w-20" /></div>)}</div>;
}
