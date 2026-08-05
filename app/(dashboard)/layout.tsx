import { AppHeader } from "@/components/layout/app-header";
import { ToastProvider } from "@/components/common/toast-provider";
import { requireAuthorizedUser } from "@/lib/auth/guards";
import { getUserById } from "@/lib/users/user-service";
import { findEmployeeTeamVisibility } from "@/lib/employees/org-service";
import { getRequestNotificationSummary } from "@/lib/requests/request-service";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAuthorizedUser();
  const [dbUser, teamVisibility, notificationSummary] = await Promise.all([
    getUserById(user.id),
    user.role === "employee" ? findEmployeeTeamVisibility(user.id) : Promise.resolve(null),
    user.role === "admin" || user.role === "coordinator" ? getRequestNotificationSummary(user.id, user.role) : Promise.resolve(null),
  ]);

  return (
    <ToastProvider>
      <div className="flex-1 bg-zinc-50">
        <AppHeader canCover={user.role !== "admin" && (dbUser?.canEditAllWfh ?? false)} canViewTeam={teamVisibility?.teamWfhVisible ?? false} notificationSummary={notificationSummary} user={user} />
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
