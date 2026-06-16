import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/auth/guards";
import { findEmployeeTeamVisibility } from "@/lib/users/user-repository";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const teamVisibility = user.role === "employee" ? await findEmployeeTeamVisibility(user.id) : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppHeader canViewTeam={teamVisibility?.teamWfhVisible ?? false} user={user} />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
