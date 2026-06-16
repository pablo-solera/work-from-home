import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionUser } from "@/lib/auth/session";

export function AppHeader({ canViewTeam = false, user }: { canViewTeam?: boolean; user: SessionUser }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link className="text-base font-semibold text-zinc-950" href={user.role === "admin" ? "/admin" : "/calendar"}>Work From Home</Link>

        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="text-zinc-700 hover:text-zinc-950" href="/calendar">Mi calendario</Link>
          {user.role === "coordinator" || canViewTeam ? <Link className="text-zinc-700 hover:text-zinc-950" href="/team">Mi equipo</Link> : null}
          {user.role === "admin" ? <Link className="text-zinc-700 hover:text-zinc-950" href="/admin">Admin</Link> : null}
          <UserMenu user={user} />
        </nav>
      </div>
    </header>
  );
}
