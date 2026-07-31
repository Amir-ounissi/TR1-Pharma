"use client";

import { useActionState } from "react";
import { createBrandOnboardingAction } from "@/app/(protected)/dashboard/admin/onboarding/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingCreateForm() {
  const [state, action, pending] = useActionState(createBrandOnboardingAction, {});

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <ActionFeedback error={state.error} success={state.success} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="legalName">Nom légal</Label>
        <Input id="legalName" name="legalName" required maxLength={160} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tradeName">Nom commercial</Label>
        <Input id="tradeName" name="tradeName" maxLength={160} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brandName">Nom de la marque</Label>
        <Input id="brandName" name="brandName" required maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brandCode">Code interne</Label>
        <Input id="brandCode" name="brandCode" required maxLength={40} placeholder="MARQUE_FR" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="countryCode">Pays</Label>
        <Input id="countryCode" name="countryCode" required defaultValue="FR" maxLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="currencyCode">Devise</Label>
        <Input id="currencyCode" name="currencyCode" required defaultValue="EUR" maxLength={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Fuseau horaire</Label>
        <Input id="timezone" name="timezone" required defaultValue="Europe/Paris" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locale">Langue</Label>
        <Input id="locale" name="locale" required defaultValue="fr-FR" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="externalId">Identifiant externe</Label>
        <Input id="externalId" name="externalId" maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accentColor">Couleur d’accent</Label>
        <Input id="accentColor" name="accentColor" type="color" defaultValue="#2563eb" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description courte</Label>
        <Input id="description" name="description" maxLength={300} />
      </div>
      <Button disabled={pending} className="md:col-span-2">
        {pending ? "Création sécurisée…" : "Créer l’organisation et la marque"}
      </Button>
    </form>
  );
}
