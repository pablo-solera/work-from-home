type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-zinc-200 motion-reduce:animate-none ${className}`} />;
}

export function SkeletonStatus({ label = "Cargando" }: { label?: string }) {
  return <div aria-label={label} className="sr-only" role="status" />;
}
