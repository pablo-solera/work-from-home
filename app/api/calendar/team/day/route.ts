import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getEmployeeTeamWfhDayDetail } from "@/lib/calendar/calendar-service";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const date = new URL(request.url).searchParams.get("date") ?? "";
  const sections = await getEmployeeTeamWfhDayDetail(user, date);
  if (!sections) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  return NextResponse.json({ sections }, { headers: { "Cache-Control": "private, no-store" } });
}
