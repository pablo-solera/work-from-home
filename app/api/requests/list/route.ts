import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestsForCoordinator, getRequestsForRequester, type RequestFilters } from "@/lib/requests/request-service";

function parseFilters(searchParams: URLSearchParams): RequestFilters {
  const date = searchParams.get("date");
  const status = searchParams.get("status");

  return {
    date: date === "month" || date === "week" ? date : "all",
    status: status === "pending" || status === "accepted" || status === "rejected" || status === "cancelled" ? status : "all",
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "coordinator" && user.role !== "employee") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const filters = parseFilters(url.searchParams);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const page = user.role === "coordinator"
    ? await getRequestsForCoordinator(user.id, filters, cursor)
    : await getRequestsForRequester(user.id, filters, cursor);

  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
