import { Skeleton, SkeletonStatus } from "@/components/common/skeleton";

export function UsersSkeleton() {
  return (
    <section aria-busy="true" className="space-y-8">
      <SkeletonStatus label="Cargando usuarios" />
      <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="h-4 w-full max-w-2xl" /></div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div className="space-y-2"><Skeleton className="h-7 w-32" /><Skeleton className="h-4 w-96 max-w-full" /></div><Skeleton className="h-10 w-32" /></div>
        <div className="mt-5 max-w-md"><Skeleton className="h-16 w-full" /></div>
        <div className="mt-6 overflow-hidden"><div className="grid min-w-[80rem] grid-cols-8 gap-4 border-b border-zinc-200 pb-3">{Array.from({ length: 8 }, (_, index) => <Skeleton className="h-4" key={`header-${index}`} />)}</div><div className="min-w-[80rem] divide-y divide-zinc-100">{Array.from({ length: 10 }, (_, index) => <div className="grid grid-cols-8 gap-4 py-5" key={`row-${index}`}>{Array.from({ length: 8 }, (_, cellIndex) => <Skeleton className="h-5" key={`cell-${index}-${cellIndex}`} />)}</div>)}</div></div>
        <div className="mt-6 flex justify-between border-t border-zinc-100 pt-4"><Skeleton className="h-5 w-24" /><Skeleton className="h-8 w-32" /></div>
      </div>
    </section>
  );
}
