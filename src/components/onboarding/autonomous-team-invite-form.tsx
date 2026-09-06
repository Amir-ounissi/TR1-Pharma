"use client";

import { useActionState } from "react";
import { inviteAutonomousTeamMemberAction } from "@/app/(auth)/setup/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AutonomousTeamInviteForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState(inviteAutonomousTeamMemberAction, {});

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="md:col-span-2"><ActionFeedback error={state.error} success={state.success} /></div>
      <div className="space-y-2">
        <Label htmlFor="autonomous-team-name">Nom complet</Label>
        <Input id="autonomous-team-name" name="fullName" required placeholder="Prénom Nom" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="autonomous-team-email">Email professionnel</Label>
        <Input id="autonomous-team-email" name="email" type="email" required placeholder="prenom@entreprise.com" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="autonomous-team-role">Rôle</Label>
        <select id="autonomous-team-role" name="roleKey" defaultValue="agent" className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
          <option value="brand_admin">Administrateur de marque</option>
          <option value="brand_user">Utilisateur de marque</option>
          <option value="agent">Commercial terrain</option>
          <option value="facilitator">Intervenant animation / formation</option>
        </select>
      </div>
      <Button disabled={pending} className="md:col-span-2">
        {pending ? "Invitation…" : "Inviter ce membre"}
      </Button>
    </form>
  );
}
