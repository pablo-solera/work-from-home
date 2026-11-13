"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/common/button";
import { Dropdown } from "@/components/common/dropdown";

type RequestFiltersProps = {
  date: "all" | "month" | "week";
  status: "all" | "pending" | "accepted" | "rejected" | "cancelled";
  defaultStatus?: "all" | "pending" | "accepted" | "rejected" | "cancelled";
};

const DATE_OPTIONS = [
  { label: "Todas", value: "all" },
  { label: "Este mes", value: "month" },
  { label: "Esta semana", value: "week" },
] as const;

const STATUS_OPTIONS = [
  { label: "Todas", value: "all" },
  { label: "Pendiente", value: "pending" },
  { label: "Aceptado", value: "accepted" },
  { label: "Rechazado", value: "rejected" },
  { label: "Cancelado", value: "cancelled" },
] as const;

export function RequestFilters({ date, status, defaultStatus = "all" }: RequestFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasFilters = date !== "all" || status !== defaultStatus;

  function updateFilter(name: "date" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all" && (name !== "status" || defaultStatus === "all")) {
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
        <div className="space-y-1 text-sm font-medium text-zinc-700">
          <span className="block">Fecha solicitada</span>
          <Dropdown aria-label="Fecha solicitada" onChange={(next) => updateFilter("date", next)} options={DATE_OPTIONS} value={date} />
        </div>
        <div className="space-y-1 text-sm font-medium text-zinc-700">
          <span className="block">Estado</span>
          <Dropdown aria-label="Estado" onChange={(next) => updateFilter("status", next)} options={STATUS_OPTIONS} value={status} />
        </div>
        {hasFilters ? <Button onClick={() => { const params = new URLSearchParams(searchParams.toString()); params.delete("date"); params.delete("status"); const query = params.toString(); router.push(query ? `${pathname}?${query}` : pathname); }} variant="secondary">Limpiar filtros</Button> : <span />}
      </div>
    </div>
  );
}
