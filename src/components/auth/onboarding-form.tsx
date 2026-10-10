"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { completeOnboardingAction } from "@/app/(auth)/onboarding/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({
  defaultName,
  requiresPassword = false,
}: {
  defaultName?: string | null;
  requiresPassword?: boolean;
}) {
  const [state, action, pending] = useActionState(completeOnboardingAction, {});

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <Alert variant="destructive" className="rounded-xl border-[#d95034]/30 bg-[#fff1ec] text-[#8f2e19]" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-[0.1em] text-[#445265]">
          Nom complet
        </Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultName ?? ""}
          autoComplete="name"
          placeholder="Votre prénom et nom"
          minLength={2}
          maxLength={120}
          className="h-12 rounded-xl border-[#d8d0c2] bg-white px-4 text-base text-[#0b1e32] shadow-none placeholder:text-[#9ca3af] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25"
          required
        />
      </div>
      {requiresPassword ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.1em] text-[#445265]">
              Mot de passe
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="h-12 rounded-xl border-[#d8d0c2] bg-white px-4 text-base shadow-none focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-[0.1em] text-[#445265]">
              Confirmer le mot de passe
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="h-12 rounded-xl border-[#d8d0c2] bg-white px-4 text-base shadow-none focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25"
              required
            />
          </div>
        </>
      ) : null}
      <Button
        className="mt-2 h-12 w-full rounded-xl bg-[#c84f24] text-sm font-bold text-white shadow-[0_10px_22px_rgb(200_79_36/0.18)] transition-colors hover:bg-[#a63f19]"
        disabled={pending}
      >
        {pending ? "Enregistrement…" : "Continuer"}
        {!pending ? <ArrowRight className="ml-2 size-4" aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
