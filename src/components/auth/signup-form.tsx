"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/app/(auth)/signup/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, {});

  return (
    <form action={action} className="space-y-5">
      {state.error || state.success ? (
        <Alert variant={state.error ? "destructive" : "default"} className={state.error ? "border-[#d95034]/35 bg-[#fff1ec] text-[#8f2e19]" : "border-[#0b1e32]/10 bg-[#f4f8f3] text-[#1f5130]"}>
          <AlertDescription>{state.error ?? state.success}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Nom complet</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Prénom Nom" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Email professionnel</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="vous@marque.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Au moins 8 caractères" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Confirmer le mot de passe</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Répétez le mot de passe" />
      </div>
      <Button className="h-12 w-full rounded-xl bg-[#c84f24] text-sm font-black text-white shadow-[0_16px_34px_rgba(200,79,36,.24)] hover:bg-[#a63f19]" disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-center text-xs leading-5 text-[#667384]">
        Une fois le compte créé, un accès marque devra encore vous être attribué pour entrer dans la plateforme.
      </p>
      <p className="text-center text-sm text-[#445265]">
        Déjà un compte ?{" "}
        <Link className="font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
