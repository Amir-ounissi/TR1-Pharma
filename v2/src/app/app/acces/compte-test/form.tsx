"use client";

import { useActionState } from "react";
import {
  createPilotTestAccount,
  finalizePilotTestAccount,
  initialTestAccountState,
} from "./actions";

export function PharmacyTestSetupForm() {
  const [createState, createAction, creating] = useActionState(createPilotTestAccount, initialTestAccountState);
  const [linkState, linkAction, linking] = useActionState(finalizePilotTestAccount, initialTestAccountState);
  return <div className="grid gap-5 md:grid-cols-2">
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-bold">1. Créer le compte dans Supabase Auth</h2>
      <p className="mt-2 text-sm text-[#69717d]">
        Le mot de passe est transmis directement à Supabase Auth depuis le serveur V2.
        Il n’est ni conservé dans la base métier, ni enregistré dans le code.
      </p>
      <form action={createAction} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">Adresse email du compte test
          <input type="email" value="amir.ounissi69@gmail.com" readOnly
            className="rounded-lg border bg-[#f4f5f5] p-3 text-sm" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Nouveau mot de passe
          <input name="password" type="password" required minLength={12} maxLength={128}
            autoComplete="new-password" className="rounded-lg border p-3 text-sm"
            placeholder="12 caractères minimum · différent de l’admin"/>
        </label>
        <button disabled={creating}
          className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {creating?"Création…":"Créer le compte test"}
        </button>
      </form>
      {createState.kind!=="idle"?<p role="status" className="mt-4 rounded-lg border p-3 text-sm">{createState.message}</p>:null}
    </section>
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-bold">2. Confirmer et rattacher à Plein Sud</h2>
      <p className="mt-2 text-sm leading-6 text-[#69717d]">
        Si Supabase demande une confirmation par email, elle doit être effectuée avant le rattachement.
        Le rôle obtenu sera uniquement <strong>pharmacy</strong>, et l’accès VK SWISS restera désactivé.
      </p>
      <form action={linkAction} className="mt-5">
        <button disabled={linking}
          className="rounded-lg border border-[#142941] px-5 py-3 text-sm font-bold disabled:opacity-50">
          {linking?"Vérification…":"Finaliser le rattachement"}
        </button>
      </form>
      {linkState.kind!=="idle"?<p role="status" className="mt-4 rounded-lg border p-3 text-sm">{linkState.message}</p>:null}
    </section>
  </div>;
}
