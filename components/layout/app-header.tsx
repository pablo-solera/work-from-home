import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { RequestBadges } from "@/components/layout/request-badges";
import type { SessionUser } from "@/lib/auth/session";

export function AppHeader({ canCover = false, canViewTeam = false, pendingRequestCount = 0, unreadSubstitutionCount = 0, user }: { canCover?: boolean; canViewTeam?: boolean; pendingRequestCount?: number; unreadSubstitutionCount?: number; user: SessionUser }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link className="cursor-pointer text-base font-semibold text-zinc-950" href={user.role === "admin" ? "/admin" : "/calendar"}>Work From Home</Link>

        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="cursor-pointer text-zinc-700 hover:text-zinc-950" href="/calendar">Mi calendario</Link>
          {user.role !== "admin" ? <Link className="inline-flex cursor-pointer items-center text-zinc-700 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" href="/requests"><span>Solicitudes</span>{user.role === "coordinator" ? <RequestBadges pendingRequestCount={pendingRequestCount} unreadSubstitutionCount={unreadSubstitutionCount} /> : null}</Link> : null}
          {user.role === "coordinator" || canViewTeam ? <Link className="cursor-pointer text-zinc-700 hover:text-zinc-950" href="/team">Mi equipo</Link> : null}
          {canCover ? <Link className="cursor-pointer text-zinc-700 hover:text-zinc-950" href="/coverage">Cobertura</Link> : null}
          {user.role === "admin" ? <Link className="cursor-pointer text-zinc-700 hover:text-zinc-950" href="/admin">Admin</Link> : null}
          <UserMenu user={user} />
        </nav>
      </div>
    </header>
  );
}
