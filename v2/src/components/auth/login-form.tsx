"use client";
import { useActionState } from "react";
import { signInAction, type LoginState } from "@/app/auth-actions";

const empty: LoginState = {};
export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, empty);
  return (
    <form action={action} className="mt-8 grid gap-4">
      {state.error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      <label className="grid gap-2 text-sm font-semibold">Adresse email
        <input name="email" type="email" autoComplete="email" required className="h-12 rounded-lg border border-[#cbd5dc] px-3" />
      </label>
      <label className="grid gap-2 text-sm font-semibold">Mot de passe
        <input name="password" type="password" autoComplete="current-password" required className="h-12 rounded-lg border border-[#cbd5dc] px-3" />
      </label>
      <button disabled={pending} className="min-h-12 rounded-lg bg-[#142941] px-5 font-semibold text-white disabled:opacity-50">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-xs leading-5 text-[#69717d]">Accès réservé aux comptes expressément autorisés. Aucune inscription publique automatique.</p>
    </form>
  );
}
