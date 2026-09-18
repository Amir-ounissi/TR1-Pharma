"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });

    setPending(false);

    if (error) {
      setErrorMessage("Impossible d’envoyer le lien pour le moment. Réessayez dans quelques instants.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4.6rem)] max-w-xl items-center px-5 py-12">
      <section className="w-full overflow-hidden rounded-[1.6rem] border border-[#0b1e32]/10 bg-[#fffefa] shadow-[0_24px_70px_rgba(7,20,33,.12)]">
        <div className="border-b border-[#0b1e32]/10 bg-[#071421] px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-2 font-mono text-[.68rem] font-black uppercase tracking-[.16em] text-[#ff9d78]">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Sécurité TR1 Pharma
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-[-.05em]">Réinitialisez votre mot de passe.</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Indiquez l’adresse email utilisée pour votre compte TR1. Nous vous enverrons un lien sécurisé.
          </p>
        </div>

        <div className="space-y-6 px-6 py-7 sm:px-8">
          {sent ? (
            <div className="space-y-5">
              <Alert className="border-[#2f7d5a]/25 bg-[#eef9f2] text-[#1e5f42]">
                <Mail className="size-4" aria-hidden="true" />
                <AlertDescription>
                  Si un compte TR1 correspond à cette adresse, un email de réinitialisation vient d’être envoyé. Vérifiez aussi vos courriers indésirables.
                </AlertDescription>
              </Alert>
              <Button asChild className="h-12 w-full rounded-xl bg-[#0b1e32] text-sm font-black text-white hover:bg-[#132e49]">
                <Link href="/login">Retour à la connexion</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={submit}>
              {errorMessage ? (
                <Alert variant="destructive" className="border-[#d95034]/35 bg-[#fff1ec] text-[#8f2e19]">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">
                  Email professionnel
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25"
                  placeholder="vous@marque.com"
                />
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-[#c84f24] text-sm font-black text-white shadow-[0_16px_34px_rgba(200,79,36,.24)] hover:bg-[#a63f19]"
                type="submit"
                disabled={pending}
              >
                {pending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
              </Button>
            </form>
          )}

          <Link className="inline-flex items-center gap-2 text-sm font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour à la connexion
          </Link>
        </div>
      </section>
    </main>
  );
}
