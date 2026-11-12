import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { getRequestsForCoordinator, getRequestsForRequester } from "@/lib/requests/request-service";
import { parseRequestFilters } from "@/lib/requests/request-filters";

export async function GET(request: Request) {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "coordinator" && user.role !== "employee") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const filters = parseRequestFilters(url.searchParams);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const own = url.searchParams.get("own") === "true";
  try {
    const page = user.role === "coordinator" && !own
      ? await getRequestsForCoordinator(user.id, filters, cursor)
      : await getRequestsForRequester(user.id, filters, cursor);
    return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Failed to load request list:", error);
    return NextResponse.json({ error: "No se pudieron cargar las solicitudes." }, { status: 500 });
  }
}
