"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { forgotPasswordAction } from "./actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});

  return (
    <section className="mx-auto grid min-h-[calc(100vh-4.6rem)] max-w-7xl items-center gap-12 px-5 py-10 lg:grid-cols-[.9fr_.7fr] lg:px-8 lg:py-16">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0b1e32]/10 bg-white/80 px-3 py-2 font-mono text-[.62rem] font-black uppercase tracking-[.14em] text-[#c84f24]">
          <Mail className="size-3.5" aria-hidden="true" />
          Récupération de compte
        </div>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-[2.8rem] font-black leading-[.95] tracking-[-.07em] text-[#0b1e32] sm:text-[4.4rem]">
            Mot de passe <span className="text-[#c84f24]">oublié ?</span>
          </h1>
          <p className="max-w-xl text-base leading-7 text-[#667384] sm:text-lg">
            Saisissez votre email. TR1 vous enverra un lien sécurisé pour choisir un nouveau mot de passe.
          </p>
        </div>
        <Link className="inline-flex items-center gap-2 font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour à la connexion
        </Link>
      </div>

      <Card className="overflow-hidden rounded-[1.6rem] border border-[#0b1e32]/10 bg-white/92 shadow-[0_24px_70px_rgba(7,20,33,.12)]">
        <CardContent className="p-0">
          <div className="border-b border-[#0b1e32]/10 bg-[#071421] px-6 py-7 text-white sm:px-8">
            <p className="font-mono text-[.68rem] font-black uppercase tracking-[.16em] text-[#ff9d78]">
              Sécurité TR1 Pharma
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-.05em]">Recevez votre lien de réinitialisation.</h2>
          </div>
          <div className="bg-[#fffefa] px-6 py-7 sm:px-8">
            <form action={action} className="space-y-5">
              {state.error ? (
                <Alert variant="destructive" className="border-[#d95034]/35 bg-[#fff1ec] text-[#8f2e19]">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              {state.success ? (
                <Alert className="border-[#0b1e32]/10 bg-white text-[#0b1e32]">
                  <AlertDescription>{state.success}</AlertDescription>
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
                  className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25"
                  placeholder="vous@marque.com"
                />
              </div>

              <Button className="h-12 w-full rounded-xl bg-[#c84f24] text-sm font-black text-white shadow-[0_16px_34px_rgba(200,79,36,.24)] hover:bg-[#a63f19]" disabled={pending}>
                {pending ? "Envoi…" : "Envoyer le lien"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
