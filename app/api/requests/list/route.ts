import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestsForCoordinator, getRequestsForRequester } from "@/lib/requests/request-service";
import { parseRequestFilters } from "@/lib/requests/request-filters";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "coordinator" && user.role !== "employee") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const filters = parseRequestFilters(url.searchParams);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const page = user.role === "coordinator"
    ? await getRequestsForCoordinator(user.id, filters, cursor)
    : await getRequestsForRequester(user.id, filters, cursor);

  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
