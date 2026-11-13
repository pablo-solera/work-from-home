export function ActionFeedback({ error, message }: { error?: string | null; message?: string | null }) {
  return (
    <>
      {error ? <p aria-live="assertive" className="text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p aria-live="polite" className="text-sm text-emerald-700" role="status">{message}</p> : null}
    </>
  );
}
