"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/(auth)/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <Alert variant="destructive" className="border-[#d95034]/35 bg-[#fff1ec] text-[#8f2e19]">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Email professionnel</Label>
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
      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
          className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25"
          placeholder="Votre mot de passe"
        />
      </div>
      <Button className="h-12 w-full rounded-xl bg-[#c84f24] text-sm font-black text-white shadow-[0_16px_34px_rgba(200,79,36,.24)] hover:bg-[#a63f19]" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <p className="text-center text-xs leading-5 text-[#667384]">
        Votre accès dépend de votre rôle, de votre marque active et de vos autorisations opérationnelles.
      </p>
    </form>
  );
}
