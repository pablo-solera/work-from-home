import { initialBulkUserFormState, type BulkUserFormState } from "@/lib/users/bulk-user-form-state";

export function UserCreationResult({ result }: { result?: BulkUserFormState }) {
  const safeResult = result ?? initialBulkUserFormState;
  const created = safeResult.created ?? [];
  const skipped = safeResult.skipped ?? [];
  const invalid = safeResult.invalid ?? [];
  const hasResults = created.length > 0 || skipped.length > 0 || invalid.length > 0 || safeResult.error;

  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-zinc-950">Resultado</h2>
      {!hasResults ? <p className="mt-3 text-sm text-zinc-500">Aún no se han creado usuarios.</p> : null}
      {safeResult.error ? <p className="mt-3 text-sm text-red-600">{safeResult.error}</p> : null}
      {created.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-emerald-700">Creados</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700">
            {created.map((user) => <li key={user.email} className="rounded-lg bg-emerald-50 p-2">{user.email} · <span className="font-mono">{user.password}</span></li>)}
          </ul>
        </div>
      ) : null}
      {skipped.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-amber-700">Omitidos</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700">
            {skipped.map((user) => <li key={user.email}>{user.email}: {user.reason}</li>)}
          </ul>
        </div>
      ) : null}
      {invalid.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-red-700">Inválidos</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700">
            {invalid.map((email) => <li key={email}>{email}</li>)}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
