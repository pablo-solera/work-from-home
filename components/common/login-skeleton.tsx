import { Skeleton, SkeletonStatus } from "@/components/common/skeleton";

export function LoginSkeleton() {
  return <main aria-busy="true" className="flex flex-1 items-center justify-center bg-zinc-50 px-6"><SkeletonStatus label="Cargando inicio de sesión" /><section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"><div className="mb-8 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-48" /></div><div className="space-y-4"><div><Skeleton className="h-4 w-16" /><Skeleton className="mt-2 h-10 w-full" /></div><div><Skeleton className="h-4 w-24" /><Skeleton className="mt-2 h-10 w-full" /></div><Skeleton className="h-10 w-full" /></div></section></main>;
}
