"use client";

import { useActionState } from "react";
import { completeOnboardingAction } from "@/app/(auth)/onboarding/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({ defaultName }: { defaultName?: string | null }) {
  const [state, action, pending] = useActionState(completeOnboardingAction, {});
  return (
    <form action={action} className="space-y-5">
      {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input id="fullName" name="fullName" defaultValue={defaultName ?? ""} autoComplete="name" required />
      </div>
      <Button className="w-full" disabled={pending}>{pending ? "Enregistrement…" : "Continuer"}</Button>
    </form>
  );
}
