import { decideWfhRequestAction } from "@/app/(dashboard)/requests/actions";
import { formatDateKeyForDisplay } from "@/lib/calendar/dates";

const statusLabels = { accepted: "Aceptado", pending: "Pendiente", rejected: "Rechazado" } as const;
const statusStyles = {
  accepted: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
} as const;

type RequestListItem = {
  id: string;
  kind: "additional" | "substitution";
  status: "accepted" | "pending" | "rejected";
  requesterComment: string | null;
  decisionComment: string | null;
  dates: Array<{ requestedDate: string; replacedDate: string | null }>;
  requesterName?: string;
  requesterEmail?: string;
};

function formatDates(dates: Array<{ requestedDate: string; replacedDate: string | null }>, kind: string) {
  return dates.map((date) => kind === "substitution" && date.replacedDate ? `${formatDateKeyForDisplay(date.replacedDate)} → ${formatDateKeyForDisplay(date.requestedDate)}` : formatDateKeyForDisplay(date.requestedDate)).join(", ");
}

export function RequestList({ requests, coordinatorView = false }: { coordinatorView?: boolean; requests: RequestListItem[] }) {
  if (requests.length === 0) {
    return <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No hay solicitudes.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <article className="rounded-xl border border-zinc-200 bg-white p-5" key={request.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {coordinatorView ? <p className="font-semibold text-zinc-950">{request.requesterName} <span className="font-normal text-zinc-500">({request.requesterEmail})</span></p> : null}
              <p className="mt-1 text-sm text-zinc-700">{request.kind === "substitution" ? "Sustitución" : "Días adicionales"}</p>
              <p className="mt-1 text-sm text-zinc-600">{formatDates(request.dates, request.kind)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.status]}`}>{request.kind === "substitution" && request.status === "accepted" ? "Aplicada" : statusLabels[request.status]}</span>
          </div>
          {request.requesterComment ? <p className="mt-3 text-sm text-zinc-600">Comentario: {request.requesterComment}</p> : null}
          {request.decisionComment ? <p className="mt-2 text-sm text-zinc-600">Respuesta: {request.decisionComment}</p> : null}
          {coordinatorView && request.status === "pending" ? (
            <form action={decideWfhRequestAction} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
              <input name="id" type="hidden" value={request.id} />
              <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" name="comment" placeholder="Comentario opcional" />
              <div className="flex gap-2">
                <button className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white" name="status" type="submit" value="accepted">Aceptar</button>
                <button className="cursor-pointer rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white" name="status" type="submit" value="rejected">Rechazar</button>
              </div>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}
