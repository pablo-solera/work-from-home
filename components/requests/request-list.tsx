"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateKeyForDisplay, getMadridTodayDateKey } from "@/lib/calendar/dates";
import { MarkSubstitutionReadButton } from "@/components/requests/mark-substitution-read-button";
import { RequestDecisionForm } from "@/components/requests/request-decision-form";
import { CancelRequestDateButton } from "@/components/requests/cancel-request-date-button";
import type { RequestFilters, RequestPage } from "@/lib/requests/request-service";

const statusLabels = { accepted: "Aceptado", pending: "Pendiente", rejected: "Rechazado", cancelled: "Cancelado" } as const;
const statusStyles = {
  accepted: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-100 text-zinc-700",
} as const;

type RequestListItem = {
  id: string;
  kind: "additional" | "substitution";
  status: "accepted" | "pending" | "rejected" | "cancelled";
  requesterComment: string | null;
  decisionComment: string | null;
  dates: Array<{ id: string; requestedDate: string; replacedDate: string | null; cancelledAt?: Date | string | null }>;
  requesterName?: string;
  requesterEmail?: string;
  coordinatorNotifiedAt?: Date | string | null;
  coordinatorAcknowledgedAt?: Date | string | null;
};

function RequestList({ initialPage, coordinatorView = false, filtered = false, filters }: { coordinatorView?: boolean; filtered?: boolean; initialPage: RequestPage<RequestListItem>; filters: RequestFilters }) {
  const [requests, setRequests] = useState(initialPage.requests);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || error) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || loading) return;

      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ date: filters.date, status: filters.status, cursor: nextCursor });
      fetch(`/api/requests/list?${params.toString()}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("No se pudieron cargar más solicitudes.");
          return response.json() as Promise<RequestPage<RequestListItem>>;
        })
        .then((page) => {
          setRequests((current) => [...current, ...page.requests]);
          setNextCursor(page.nextCursor);
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar más solicitudes."))
        .finally(() => setLoading(false));
    }, { rootMargin: "320px 0px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, filters.date, filters.status, loading, nextCursor, retryCount]);

  if (requests.length === 0) {
    return <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">{filtered ? "No hay solicitudes que coincidan con los filtros seleccionados." : "No hay solicitudes."}</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <article className={`rounded-xl border bg-white p-5 ${coordinatorView && request.coordinatorNotifiedAt && !request.coordinatorAcknowledgedAt ? "border-sky-300 bg-sky-50/40" : "border-zinc-200"}`} key={request.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {coordinatorView ? <p className="font-semibold text-zinc-950">{request.requesterName} <span className="font-normal text-zinc-500">({request.requesterEmail})</span></p> : null}
              <p className="mt-1 text-sm text-zinc-700">{request.kind === "substitution" ? "Sustitución" : "Días adicionales"}</p>
              <div className="mt-1 space-y-1 text-sm text-zinc-600">
                {request.dates.map((date) => {
                  const dateLabel = request.kind === "substitution" && date.replacedDate ? `${formatDateKeyForDisplay(date.replacedDate)} → ${formatDateKeyForDisplay(date.requestedDate)}` : formatDateKeyForDisplay(date.requestedDate);
                  const canCancel = !coordinatorView && request.kind === "additional" && request.status === "pending" && !date.cancelledAt && date.requestedDate > getMadridTodayDateKey();

                  return <div className="flex flex-wrap items-center justify-between gap-2" key={date.id}><span className={date.cancelledAt ? "line-through text-zinc-400" : undefined}>{dateLabel}{date.cancelledAt ? " · Cancelado" : ""}</span>{canCancel ? <CancelRequestDateButton dateId={date.id} dateLabel={formatDateKeyForDisplay(date.requestedDate)} requestId={request.id} /> : null}</div>;
                })}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.status]}`}>{request.kind === "substitution" && request.status === "accepted" ? "Aplicada" : statusLabels[request.status]}</span>
          </div>
          {request.requesterComment ? <p className="mt-3 text-sm text-zinc-600">Comentario: {request.requesterComment}</p> : null}
          {request.decisionComment ? <p className="mt-2 text-sm text-zinc-600">Respuesta: {request.decisionComment}</p> : null}
          {coordinatorView && request.coordinatorNotifiedAt && !request.coordinatorAcknowledgedAt ? <div className="mt-3 flex items-center justify-between gap-3"><span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">Nueva</span><MarkSubstitutionReadButton requestId={request.id} /></div> : null}
          {coordinatorView && request.status === "pending" ? (
            <RequestDecisionForm requestId={request.id} />
          ) : null}
        </article>
      ))}
      <div aria-live="polite" className="py-3 text-center text-sm text-zinc-500" ref={sentinelRef}>
        {loading ? "Cargando más solicitudes..." : error ? <button className="cursor-pointer font-medium text-zinc-950 underline" onClick={() => { setError(null); setRetryCount((count) => count + 1); }} type="button">Reintentar</button> : nextCursor ? "Cargando más solicitudes..." : "No hay más solicitudes."}
        {error ? <span className="ml-2 text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}

export function CoordinatorRequestList({ filtered = false, initialPage, filters }: { filtered?: boolean; initialPage: RequestPage<RequestListItem>; filters: RequestFilters }) {
  return <RequestList key={getPageKey(initialPage)} coordinatorView filtered={filtered} filters={filters} initialPage={initialPage} />;
}

export function RequesterRequestList({ filtered = false, initialPage, filters }: { filtered?: boolean; initialPage: RequestPage<RequestListItem>; filters: RequestFilters }) {
  return <RequestList key={getPageKey(initialPage)} filtered={filtered} filters={filters} initialPage={initialPage} />;
}

function getPageKey(page: RequestPage<RequestListItem>) {
  return page.requests.map((request) => `${request.id}:${request.status}:${request.decisionComment ?? ""}:${request.coordinatorAcknowledgedAt ?? ""}`).join("|") || "empty";
}
