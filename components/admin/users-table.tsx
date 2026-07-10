"use client";

import { useDeferredValue, useState } from "react";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { DeleteUserDialog } from "./delete-user-dialog";
import { SyncUsersButton } from "./sync-users-button";
import { UserFormModal } from "./user-form-modal";
import { UserPasswordModal } from "./user-password-modal";

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
  coordinators: UserCoordinatorOption[];
  currentUserId: string;
  users: ManagedUser[];
};

type ModalState =
  | { type: "delete"; user: ManagedUser }
  | { type: "edit"; user: ManagedUser }
  | { type: "password"; user: ManagedUser }
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

const PAGE_SIZE = 10;

export function UsersTable({ coordinators, currentUserId, users }: UsersTableProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filteredUsers = deferredQuery
    ? users.filter((user) => {
        const searchable = [user.name, user.email, roleLabels[user.role], user.coordinator?.name, user.coordinator?.email].filter(Boolean).join(" ").toLowerCase();

        return searchable.includes(deferredQuery);
      })
    : users;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Usuarios</h2>
          <p className="mt-1 text-sm text-zinc-600">Gestiona roles, coordinadores, contraseñas y opciones de teletrabajo. Las altas y bajas se sincronizan desde TimerTask.</p>
        </div>

        <SyncUsersButton />
      </div>

      <label className="mt-5 block max-w-md space-y-2">
        <span className="text-sm font-medium text-zinc-700">Buscar</span>
        <input
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Nombre, email, rol o coordinador"
          value={query}
        />
      </label>

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
            {paginatedUsers.map((user) => {
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
                      <button className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" onClick={() => setModal({ type: "password", user })} type="button">
                        Contraseña
                      </button>
                      <button className="cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={isCurrentUser} onClick={() => setModal({ type: "delete", user })} type="button">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 ? <p className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No hay usuarios que coincidan con la búsqueda.</p> : null}

      {filteredUsers.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {filteredUsers.length} {filteredUsers.length === 1 ? "usuario" : "usuarios"}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-3">
              <button
                aria-label="Página anterior"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <button
                aria-label="Página siguiente"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 p-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                type="button"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {modal?.type === "edit" ? <UserFormModal coordinators={coordinators} currentUserId={currentUserId} onClose={() => setModal(null)} user={modal.user} /> : null}
      {modal?.type === "password" ? <UserPasswordModal onClose={() => setModal(null)} user={modal.user} /> : null}
      {modal?.type === "delete" ? <DeleteUserDialog currentUserId={currentUserId} onClose={() => setModal(null)} user={modal.user} /> : null}
    </div>
  );
}
