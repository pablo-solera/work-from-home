"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RequestFiltersProps = {
  date: "all" | "month" | "week";
  status: "all" | "pending" | "accepted" | "rejected";
};

export function RequestFilters({ date, status }: RequestFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasFilters = date !== "all" || status !== "all";

  function updateFilter(name: "date" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-sm font-medium text-zinc-700">
          Fecha solicitada
          <select className="mt-1 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal" onChange={(event) => updateFilter("date", event.target.value)} value={date}>
            <option value="all">Todas</option>
            <option value="month">Este mes</option>
            <option value="week">Esta semana</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Estado
          <select className="mt-1 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal" onChange={(event) => updateFilter("status", event.target.value)} value={status}>
            <option value="all">Todas</option>
            <option value="pending">Pendiente</option>
            <option value="accepted">Aceptado</option>
            <option value="rejected">Rechazado</option>
          </select>
        </label>
        {hasFilters ? <button className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100" onClick={() => router.push(pathname)} type="button">Limpiar filtros</button> : <span />}
      </div>
    </div>
  );
}
