export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Work From Home</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Página no encontrada</h1>
        <p className="mt-2 text-sm text-zinc-600">La dirección solicitada no existe.</p>
      </section>
    </main>
  );
}
