import type { BulkUserFormState } from "@/app/(dashboard)/admin/users/actions";

export function UserCreationResult({ result }: { result: BulkUserFormState }) {
  const hasResults = result.created.length > 0 || result.skipped.length > 0 || result.invalid.length > 0 || result.error;

  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-zinc-950">Resultado</h2>
      {!hasResults ? <p className="mt-3 text-sm text-zinc-500">Aún no se han creado usuarios.</p> : null}
      {result.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}
      {result.created.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-emerald-700">Creados</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700">
            {result.created.map((user) => <li key={user.email} className="rounded-lg bg-emerald-50 p-2">{user.email} · <span className="font-mono">{user.password}</span></li>)}
          </ul>
        </div>
      ) : null}
      {result.skipped.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-amber-700">Omitidos</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700">
            {result.skipped.map((user) => <li key={user.email}>{user.email}: {user.reason}</li>)}
          </ul>
        </div>
      ) : null}
      {result.invalid.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-red-700">Inválidos</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700">
            {result.invalid.map((email) => <li key={email}>{email}</li>)}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
