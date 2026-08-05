import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/guards";
import { getRequestNotificationSummary } from "@/lib/requests/request-service";

export async function GET() {
  const user = await getAuthorizedUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "coordinator") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const summary = await getRequestNotificationSummary(user.id, user.role);
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
