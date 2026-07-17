"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/(auth)/login/actions";
import { SubmitButton } from "@/components/common/submit-button";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input autoComplete="email" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="email" spellCheck={false} type="email" required />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-700">Contraseña</span>
        <input autoComplete="current-password" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950" name="password" type="password" required />
      </label>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
