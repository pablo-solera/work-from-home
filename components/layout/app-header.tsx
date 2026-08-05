import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { RequestBadges } from "@/components/layout/request-badges";
import { RequestSync } from "@/components/layout/request-sync";
import { ActiveNavLink } from "@/components/layout/active-nav-link";
import type { SessionUser } from "@/lib/auth/session";
import type { RequestNotificationSummary } from "@/lib/requests/request-service";

export function AppHeader({ canCover = false, canViewTeam = false, notificationSummary, user }: { canCover?: boolean; canViewTeam?: boolean; notificationSummary: RequestNotificationSummary | null; user: SessionUser }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link className="cursor-pointer text-base font-semibold text-zinc-950" href={user.role === "admin" ? "/admin" : "/calendar"}>Work From Home</Link>

        </div>
        <nav className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ActiveNavLink href="/calendar">Mi calendario</ActiveNavLink>
            {user.role !== "admin" ? <ActiveNavLink href="/requests"><span>Solicitudes</span>{user.role === "coordinator" && notificationSummary ? <RequestBadges key={notificationSummary.revision ?? "empty"} {...notificationSummary} /> : null}</ActiveNavLink> : null}
            {user.role === "admin" || user.role === "coordinator" || canViewTeam ? <ActiveNavLink href="/team">Mi equipo</ActiveNavLink> : null}
            {canCover ? <ActiveNavLink href="/coverage">Cobertura</ActiveNavLink> : null}
            {user.role === "admin" ? <><ActiveNavLink href="/admin/requests" section><span>Solicitudes</span>{notificationSummary ? <RequestBadges key={notificationSummary.revision ?? "empty"} {...notificationSummary} /> : null}</ActiveNavLink><ActiveNavLink href="/admin">Admin</ActiveNavLink></> : null}
          </div>
          <UserMenu user={user} />
          {user.role !== "admin" ? <RequestSync /> : null}
        </nav>
      </div>
    </header>
  );
}
