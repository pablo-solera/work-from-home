import Link from "next/link";
import { logoutAction } from "@/app/(dashboard)/actions";
import { GeneratedAvatar } from "@/components/common/generated-avatar";
import type { SessionUser } from "@/lib/auth/session";

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link className="text-base font-semibold text-zinc-950" href={user.role === "admin" ? "/admin" : "/calendar"}>Work From Home</Link>

        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="text-zinc-700 hover:text-zinc-950" href="/calendar">Mi calendario</Link>
          {user.role === "admin" ? <Link className="text-zinc-700 hover:text-zinc-950" href="/admin">Admin</Link> : null}
          <div className="flex items-center gap-3 border-l border-zinc-200 pl-4">
            <GeneratedAvatar name={user.name} />
            <div>
              <p className="text-sm font-medium text-zinc-950">{user.name}</p>
              <p className="text-xs capitalize text-zinc-500">{user.role}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100">Salir</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
