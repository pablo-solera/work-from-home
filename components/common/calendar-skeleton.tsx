import { Skeleton, SkeletonStatus } from "@/components/common/skeleton";

export function CalendarSkeleton({ label = "Cargando calendario", withFilter = false, withLinks = false }: { label?: string; withFilter?: boolean; withLinks?: boolean }) {
  return (
    <section aria-busy="true" className="space-y-6">
      <SkeletonStatus label={label} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {withLinks ? <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><Skeleton className="h-5 w-32" /><Skeleton className="mt-3 h-4 w-52 max-w-full" /></div><div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><Skeleton className="h-5 w-44" /><Skeleton className="mt-3 h-4 w-60 max-w-full" /></div></div> : null}
      {withFilter ? <Skeleton className="h-10 w-full max-w-sm" /> : null}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2"><Skeleton className="size-9" /><Skeleton className="h-9 w-20" /><Skeleton className="size-9" /></div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, index) => <Skeleton className="h-4" key={`heading-${index}`} />)}
          {Array.from({ length: 42 }, (_, index) => <Skeleton className="min-h-24 rounded-xl" key={`cell-${index}`} />)}
        </div>
      </div>
    </section>
  );
}
