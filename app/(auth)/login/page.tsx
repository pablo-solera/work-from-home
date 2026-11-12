import { House } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/calendar");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-panel">
        <div className="mb-8 space-y-6">
          <div className="flex items-center gap-2.5 text-base font-semibold text-zinc-950">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-zinc-950 text-white"><House className="size-4" /></span>
            Work From Home
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Iniciar sesión</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
