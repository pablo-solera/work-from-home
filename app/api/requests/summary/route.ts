import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPendingRequestCountForCoordinator, getUnreadAutomaticSubstitutionCount } from "@/lib/requests/request-service";

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "coordinator") {
    return NextResponse.json({ pendingRequestCount: 0, unreadSubstitutionCount: 0 });
  }

  const [pendingRequestCount, unreadSubstitutionCount] = await Promise.all([
    getPendingRequestCountForCoordinator(user.id),
    getUnreadAutomaticSubstitutionCount(user.id),
  ]);

  return NextResponse.json({ pendingRequestCount, unreadSubstitutionCount });
}
