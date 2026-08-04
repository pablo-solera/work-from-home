"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { SyncUsersButton } from "./sync-users-button";
import { UserFormModal } from "./user-form-modal";

export type UserCoordinatorOption = {
  email: string;
  id: string;
  name: string;
};

export type ManagedUser = {
  canEditAllWfh: boolean;
  coordinator: UserCoordinatorOption | null;
  coordinatorId: string | null;
  email: string;
  hasWfh: boolean | null;
  id: string;
  name: string;
  role: "admin" | "coordinator" | "employee";
  wfhDaysAllowance: number | null;
  wdNumber: string | null;
};

type UsersTableProps = {
  currentUserId: string;
  page: number;
  query: string;
  totalPages: number;
  totalUsers: number;
  users: ManagedUser[];
};

type ModalState =
  | { type: "edit"; user: ManagedUser }
  | null;

const roleLabels: Record<ManagedUser["role"], string> = {
  admin: "Admin",
  coordinator: "Coordinador",
  employee: "Employee",
};

const roleBadgeClasses: Record<ManagedUser["role"], string> = {
  admin: "bg-zinc-950 text-white",
  coordinator: "bg-blue-50 text-blue-700",
  employee: "bg-zinc-100 text-zinc-700",
};

export function UsersTable({ currentUserId, page, query, totalPages, totalUsers, users }: UsersTableProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState(query);
  const debouncedSearch = useDebouncedValue(search);
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pageHref = (nextPage: number) => `/admin/users?query=${encodeURIComponent(query)}&page=${nextPage}`;

  useEffect(() => {
    if (debouncedSearch === query) return;

    const params = new URLSearchParams(window.location.search);
    const trimmedSearch = debouncedSearch.trim();

    if (trimmedSearch) {
      params.set("query", trimmedSearch);
    } else {
      params.delete("query");
    }

    params.delete("page");
    const nextQuery = params.toString();
    startTransition(() => router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false }));
  }, [debouncedSearch, pathname, query, router]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Usuarios</h2>
         <p className="mt-1 text-sm text-zinc-600">Los roles y coordinadores vienen de TimerTask. Aquí administras únicamente opciones de teletrabajo.</p>
        </div>

        <SyncUsersButton />
      </div>

      <form aria-busy={isPending} className="mt-5 max-w-md" onSubmit={(event) => event.preventDefault()}>
        <label className="block flex-1 space-y-2">
          <span className="text-sm font-medium text-zinc-700">Buscar</span>
          <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-950" onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, email, rol o coordinador…" type="search" value={search} />
        </label>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[80rem] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-3 pr-4 font-semibold">WD</th>
              <th className="py-3 pr-4 font-semibold">Usuario</th>
              <th className="py-3 pr-4 font-semibold">Rol</th>
              <th className="py-3 pr-4 font-semibold">Coordinador</th>
              <th className="py-3 pr-4 font-semibold">Teletrabajo</th>
              <th className="py-3 pr-4 font-semibold">Cupo</th>
              <th className="py-3 pr-4 font-semibold">Cobertura</th>
              <th className="py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((user) => {
              const isCurrentUser = user.id === currentUserId;

              return (
                <tr key={user.id}>
                  <td className="py-4 pr-4 text-zinc-700">{user.wdNumber ?? <span className="text-zinc-400">—</span>}</td>
                  <td className="py-4 pr-4">
                    <div className="font-medium text-zinc-950">{user.name}</div>
                    <div className="text-xs text-zinc-500">{user.email}</div>
                    {isCurrentUser ? <div className="mt-1 text-xs font-medium text-emerald-700">Tu cuenta</div> : null}
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${roleBadgeClasses[user.role]}`}>{roleLabels[user.role]}</span>
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {user.coordinator ? (
                      <div>
                        <div>{user.coordinator.name}</div>
                        <div className="text-xs text-zinc-500">{user.coordinator.email}</div>
                      </div>
                    ) : (
                      <span className="text-zinc-400">Sin coordinador</span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    {user.hasWfh === null ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${user.hasWfh ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                        {user.hasWfh ? "Sí" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">{user.wfhDaysAllowance ?? <span className="text-zinc-400">—</span>}</td>
                  <td className="py-4 pr-4">
                    {user.canEditAllWfh ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Cobertura</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" onClick={() => setModal({ type: "edit", user })} type="button">
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalUsers === 0 ? <p className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No hay usuarios que coincidan con la búsqueda.</p> : null}

      {totalUsers > 0 ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {totalUsers} {totalUsers === 1 ? "usuario" : "usuarios"}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-3">
                <Link
                  aria-label="Página anterior"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  href={pageHref(Math.max(1, page - 1))}
                  aria-disabled={page === 1}
                  tabIndex={page === 1 ? -1 : undefined}
                >
                  <ChevronLeftIcon className="size-5" />
                </Link>
                <span>
                  Página {page} de {totalPages}
                </span>
                <Link
                  aria-label="Página siguiente"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  href={pageHref(Math.min(totalPages, page + 1))}
                  aria-disabled={page === totalPages}
                  tabIndex={page === totalPages ? -1 : undefined}
                >
                  <ChevronRightIcon className="size-5" />
                </Link>
            </div>
          ) : null}
        </div>
      ) : null}

       {modal?.type === "edit" ? <UserFormModal onClose={() => setModal(null)} user={modal.user} /> : null}
    </div>
  );
}
