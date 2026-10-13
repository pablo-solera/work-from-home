"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/(auth)/login/actions";
import { SubmitButton } from "@/components/common/submit-button";
import { ActionFeedback } from "@/components/common/action-feedback";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input autoComplete="email" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base focus-visible:border-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700" name="email" spellCheck={false} type="email" required />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-700">Contraseña</span>
        <input autoComplete="current-password" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base focus-visible:border-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700" name="password" type="password" required />
      </label>
      <ActionFeedback error={state.error} />
      <SubmitButton className="w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
