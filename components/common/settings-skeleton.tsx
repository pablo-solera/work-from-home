import { Skeleton, SkeletonStatus } from "@/components/common/skeleton";

export function SettingsSkeleton() {
  return <section aria-busy="true" className="space-y-6"><SkeletonStatus label="Cargando configuración" /><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-80 max-w-full" /></div><div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="max-w-2xl space-y-3"><Skeleton className="h-6 w-80 max-w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-2/3" /></div><Skeleton className="h-7 w-12 rounded-full" /></div></div></section>;
}
