export function ActionFeedback({ error, message }: { error?: string | null; message?: string | null }) {
  return (
    <>
      {error ? <p aria-live="polite" className="text-sm text-red-600" role="alert">{error}</p> : null}
      {message ? <p aria-live="polite" className="text-sm text-emerald-700">{message}</p> : null}
    </>
  );
}
