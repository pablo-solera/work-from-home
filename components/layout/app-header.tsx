import { House } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { RequestBadges } from "@/components/layout/request-badges";
import { RequestSync } from "@/components/layout/request-sync";
import { ActiveNavLink } from "@/components/layout/active-nav-link";
import { AppNav } from "@/components/layout/app-nav";
import type { SessionUser } from "@/lib/auth/session";
import type { RequestNotificationSummary } from "@/lib/requests/request-service";

export function AppHeader({ canCover = false, canViewTeam = false, notificationSummary, user }: { canCover?: boolean; canViewTeam?: boolean; notificationSummary: RequestNotificationSummary | null; user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <Link className="mr-auto flex cursor-pointer items-center gap-2.5 text-base font-semibold text-zinc-950 md:mr-4" href={user.role === "admin" ? "/admin" : "/calendar"}>
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-zinc-950 text-white"><House className="size-4" /></span>
          Work From Home
        </Link>
        <AppNav>
          <ActiveNavLink href="/calendar">Mi calendario</ActiveNavLink>
          {user.role !== "admin" ? <ActiveNavLink href="/requests"><span>Solicitudes</span>{user.role === "coordinator" && notificationSummary ? <RequestBadges {...notificationSummary} /> : null}</ActiveNavLink> : null}
          {user.role === "coordinator" || canViewTeam ? <ActiveNavLink href="/team">Mi equipo</ActiveNavLink> : null}
          {canCover ? <ActiveNavLink href="/coverage">Cobertura</ActiveNavLink> : null}
          {user.role === "admin" ? <><ActiveNavLink href="/admin/requests" section><span>Solicitudes</span>{notificationSummary ? <RequestBadges {...notificationSummary} /> : null}</ActiveNavLink><ActiveNavLink href="/admin">Administración</ActiveNavLink></> : null}
        </AppNav>
        <UserMenu user={user} />
        {user.role !== "admin" ? <RequestSync /> : null}
      </div>
    </header>
  );
}
