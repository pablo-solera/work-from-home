"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/common/badge";
import { Button, buttonClasses } from "@/components/common/button";
import { EmptyState } from "@/components/common/empty-state";
import { fieldClasses } from "@/components/common/form-classes";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { UserRole } from "@/lib/auth/session";

const UserFormModal = dynamic(() => import("./user-form-modal").then((module) => module.UserFormModal));

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
  role: UserRole;
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
  employee: "Empleado",
};

const roleTones: Record<ManagedUser["role"], BadgeTone> = {
  admin: "dark",
  coordinator: "info",
  employee: "neutral",
};

export function UsersTable({ currentUserId, page, query, totalPages, totalUsers, users }: UsersTableProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState({ value: query, query });
  const searchValue = search.query === query ? search.value : query;
  const debouncedSearch = useDebouncedValue(searchValue);
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pageHref = (nextPage: number) => `/admin/users?${query ? `query=${encodeURIComponent(query)}&` : ""}page=${nextPage}`;

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-panel sm:p-6">
      <form aria-busy={isPending} className="max-w-md" onSubmit={(event) => event.preventDefault()}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Buscar</span>
          <span className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input id="admin-user-search" name="query" autoComplete="off" className={`${fieldClasses} pl-9`} onChange={(event) => setSearch({ value: event.target.value, query })} placeholder="Nombre, email, rol o coordinador…" type="search" value={searchValue} />
          </span>
        </label>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-600">
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
                  <td className="py-4 pr-4 tabular-nums text-zinc-700">{user.wdNumber ?? <span className="text-zinc-500">—</span>}</td>
                  <td className="py-4 pr-4">
                    <div className="font-medium text-zinc-950">{user.name}</div>
                    <div className="text-xs text-zinc-600">{user.email}</div>
                    {isCurrentUser ? <div className="mt-1 text-xs font-medium text-emerald-700">Tu cuenta</div> : null}
                  </td>
                  <td className="py-4 pr-4">
                    <Badge tone={roleTones[user.role]}>{roleLabels[user.role]}</Badge>
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {user.coordinator ? (
                      <div>
                        <div>{user.coordinator.name}</div>
                        <div className="text-xs text-zinc-600">{user.coordinator.email}</div>
                      </div>
                    ) : (
                      <span className="text-zinc-500">Sin coordinador</span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    {user.hasWfh === null ? (
                      <span className="text-zinc-500">—</span>
                    ) : (
                      <Badge tone={user.hasWfh ? "remote" : "neutral"}>{user.hasWfh ? "Sí" : "No"}</Badge>
                    )}
                  </td>
                  <td className="py-4 pr-4 tabular-nums text-zinc-700">{user.wfhDaysAllowance ?? <span className="text-zinc-500">—</span>}</td>
                  <td className="py-4 pr-4">
                    {user.canEditAllWfh ? (
                      <Badge tone="pending">Cobertura</Badge>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button aria-label={`Editar ${user.name}`} onClick={() => setModal({ type: "edit", user })} size="sm" variant="secondary">
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalUsers === 0 ? <EmptyState description="Prueba con otro nombre, email, rol o coordinador." icon={Users} title="No hay usuarios que coincidan con la búsqueda" /> : null}

      {totalUsers > 0 ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {totalUsers} {totalUsers === 1 ? "usuario" : "usuarios"}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-3">
              <Link
                aria-disabled={page === 1}
                aria-label="Página anterior"
                className={`${buttonClasses("secondary", "icon")} ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
                href={pageHref(Math.max(1, page - 1))}
                tabIndex={page === 1 ? -1 : undefined}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Link>
              <span className="tabular-nums">
                Página {page} de {totalPages}
              </span>
              <Link
                aria-disabled={page === totalPages}
                aria-label="Página siguiente"
                className={`${buttonClasses("secondary", "icon")} ${page === totalPages ? "pointer-events-none opacity-50" : ""}`}
                href={pageHref(Math.min(totalPages, page + 1))}
                tabIndex={page === totalPages ? -1 : undefined}
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

       {modal?.type === "edit" ? <UserFormModal onClose={() => setModal(null)} user={modal.user} /> : null}
    </div>
  );
}
