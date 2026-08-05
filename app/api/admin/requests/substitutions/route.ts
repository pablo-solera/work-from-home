import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { getAdminSubstitutionNotifications } from "@/lib/requests/request-service";

export async function GET(request: Request) {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  return NextResponse.json(await getAdminSubstitutionNotifications(url.searchParams.get("cursor") ?? undefined), { headers: { "Cache-Control": "private, no-store" } });
}
