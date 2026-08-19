import { Skeleton, SkeletonStatus } from "@/components/common/skeleton";

export function RequestCardSkeleton({ coordinatorView = false }: { coordinatorView?: boolean }) {
  return (
    <div aria-hidden="true" className="min-h-40 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          {coordinatorView ? <Skeleton className="h-5 w-56 max-w-full" /> : null}
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-4 w-3/4 max-w-full" />
    </div>
  );
}

export function RequestListSkeleton({ coordinatorView = false, count = 10, label = "Cargando solicitudes" }: { coordinatorView?: boolean; count?: number; label?: string }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <SkeletonStatus label={label} />
      {Array.from({ length: count }, (_, index) => <RequestCardSkeleton coordinatorView={coordinatorView} key={`request-${index}`} />)}
    </div>
  );
}

export function RequestFiltersSkeleton() {
  return <div aria-hidden="true" className="rounded-xl border border-zinc-200 bg-white p-4"><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div><Skeleton className="h-4 w-32" /><Skeleton className="mt-2 h-10 w-full" /></div><div><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-10 w-full" /></div><Skeleton className="h-10 w-28" /></div></div>;
}

export function RequestViewTabsSkeleton() {
  return <div aria-hidden="true" className="border-b border-zinc-200"><div className="flex gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-8 w-32" /></div></div>;
}

export function RequestsPageSkeleton({ coordinatorView = false, showTabs = false, showFilters = true }: { coordinatorView?: boolean; showFilters?: boolean; showTabs?: boolean }) {
  return <section className="space-y-6"><SkeletonStatus label="Cargando solicitudes" /><div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-80 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>{showTabs ? <RequestViewTabsSkeleton /> : null}{showFilters ? <RequestFiltersSkeleton /> : null}<RequestListSkeleton coordinatorView={coordinatorView} /></section>;
}
