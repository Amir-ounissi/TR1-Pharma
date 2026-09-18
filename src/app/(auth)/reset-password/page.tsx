"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function bootstrapRecoverySession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (type === "recovery" && accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!active) return;

        if (!error && data.session) {
          setReady(true);
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (active) setReady(Boolean(data.session));
    }

    void bootstrapRecoverySession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setReady(Boolean(session));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Impossible de modifier le mot de passe. Demandez un nouveau lien.");
      setSaving(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.assign("/login?password=updated");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4.6rem)] max-w-xl items-center px-5 py-12">
      <section className="w-full rounded-[1.6rem] border border-[#0b1e32]/10 bg-[#fffefa] p-7 shadow-[0_24px_70px_rgba(7,20,33,.12)] sm:p-9">
        <p className="font-mono text-[.68rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Sécurité TR1 Pharma</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-.05em] text-[#0b1e32]">Choisissez un nouveau mot de passe.</h1>
        {!ready ? (
          <div className="mt-6 space-y-4 text-sm leading-6 text-[#667384]">
            <p>Ce lien de récupération est invalide ou a expiré. Demandez un nouveau lien depuis la connexion.</p>
            <Link className="font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">Retour à la connexion</Link>
          </div>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block space-y-2 text-sm font-bold text-[#0b1e32]">
              Nouveau mot de passe
              <input className="h-11 w-full rounded-lg border border-[#0b1e32]/15 bg-white px-3 font-normal outline-none focus:border-[#c84f24]" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </label>
            <label className="block space-y-2 text-sm font-bold text-[#0b1e32]">
              Confirmer le mot de passe
              <input className="h-11 w-full rounded-lg border border-[#0b1e32]/15 bg-white px-3 font-normal outline-none focus:border-[#c84f24]" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} />
            </label>
            {message ? <p className="text-sm font-semibold text-[#b42318]">{message}</p> : null}
            <Button className="w-full" type="submit" size="lg" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</Button>
          </form>
        )}
      </section>
    </main>
  );
}
