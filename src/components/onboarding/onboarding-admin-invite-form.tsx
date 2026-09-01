"use client";

import { useActionState } from "react";
import { inviteOnboardingAdminAction } from "@/app/(protected)/dashboard/admin/onboarding/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingAdminInviteForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState(inviteOnboardingAdminAction, {});

  return (
    <form action={action} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="md:col-span-3">
        <ActionFeedback error={state.error} success={state.success} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="adminName">Nom complet</Label>
        <Input id="adminName" name="fullName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="adminEmail">E-mail</Label>
        <Input id="adminEmail" name="email" type="email" required />
      </div>
      <Button disabled={pending}>{pending ? "Invitation…" : "Envoyer l’invitation"}</Button>
    </form>
  );
}
