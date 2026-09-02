"use client";

import { useActionState } from "react";
import { completeOnboardingAction } from "@/app/(auth)/onboarding/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({ defaultName, requiresPassword = false }: { defaultName?: string | null; requiresPassword?: boolean }) {
  const [state, action, pending] = useActionState(completeOnboardingAction, {});
  return (
    <form action={action} className="space-y-5">
      {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input id="fullName" name="fullName" defaultValue={defaultName ?? ""} autoComplete="name" required />
      </div>
      {requiresPassword ? <>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        </div>
      </> : null}
      <Button className="w-full" disabled={pending}>{pending ? "Enregistrement…" : "Continuer"}</Button>
    </form>
  );
}
