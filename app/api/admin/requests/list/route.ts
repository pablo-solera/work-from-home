import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { getRequestsForAdmin } from "@/lib/requests/request-service";
import { parseRequestFilters } from "@/lib/requests/request-filters";

export async function GET(request: Request) {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const page = await getRequestsForAdmin(parseRequestFilters(url.searchParams, "pending"), url.searchParams.get("cursor") ?? undefined);
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
