"use client";

import { useEffect } from "react";

export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <main className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center px-6 text-center"><h1 className="text-2xl font-semibold text-zinc-950">Se ha producido un error</h1><p className="mt-3 text-sm text-zinc-600">No se pudo cargar esta sección. Inténtalo de nuevo.</p><button className="mt-6 cursor-pointer rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" onClick={() => unstable_retry()} type="button">Reintentar</button></main>;
}
