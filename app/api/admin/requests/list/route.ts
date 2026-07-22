import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestsForAdmin, type RequestFilters } from "@/lib/requests/request-service";

function parseFilters(searchParams: URLSearchParams): RequestFilters {
  const date = searchParams.get("date");
  const status = searchParams.get("status");

  return {
    date: date === "month" || date === "week" ? date : "all",
    status: status === "pending" || status === "accepted" || status === "rejected" || status === "cancelled" ? status : "pending",
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const page = await getRequestsForAdmin(parseFilters(url.searchParams), url.searchParams.get("cursor") ?? undefined);
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
