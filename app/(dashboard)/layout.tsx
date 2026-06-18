import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/auth/guards";
import { findEmployeeTeamVisibility, findUserById } from "@/lib/users/user-repository";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [dbUser, teamVisibility] = await Promise.all([findUserById(user.id), user.role === "employee" ? findEmployeeTeamVisibility(user.id) : Promise.resolve(null)]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppHeader canCover={user.role !== "admin" && (dbUser?.canEditAllWfh ?? false)} canViewTeam={teamVisibility?.teamWfhVisible ?? false} user={user} />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
