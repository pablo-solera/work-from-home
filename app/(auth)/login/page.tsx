import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/calendar");
  }

  const params = await searchParams;
  const hasError = params?.error === "invalid";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Work From Home</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Iniciar sesión</h1>
        </div>
        <form action={loginAction} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="email" type="email" required />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Contraseña</span>
            <input className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="password" type="password" required />
          </label>
          {hasError ? <p className="text-sm text-red-600">Credenciales incorrectas.</p> : null}
          <button className="w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Entrar</button>
        </form>
      </section>
    </main>
  );
}
