import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/auth/guards";
import { findEmployeeTeamVisibility, findUserById } from "@/lib/users/user-repository";
import { getPendingRequestCountForCoordinator } from "@/lib/requests/request-service";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [dbUser, teamVisibility, pendingRequestCount] = await Promise.all([
    findUserById(user.id),
    user.role === "employee" ? findEmployeeTeamVisibility(user.id) : Promise.resolve(null),
    user.role === "coordinator" ? getPendingRequestCountForCoordinator(user.id) : Promise.resolve(0),
  ]);

  return (
    <div className="flex-1 bg-zinc-50">
      <AppHeader canCover={user.role !== "admin" && (dbUser?.canEditAllWfh ?? false)} canViewTeam={teamVisibility?.teamWfhVisible ?? false} pendingRequestCount={pendingRequestCount} user={user} />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
