import Link from "next/link";
import { buttonClasses } from "@/components/common/button";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-panel">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Página no encontrada</h1>
        <p className="mt-2 text-sm text-zinc-600">La dirección solicitada no existe.</p>
        <Link className={`${buttonClasses("primary", "md")} mt-5`} href="/login">Volver al inicio</Link>
      </section>
    </main>
  );
}
