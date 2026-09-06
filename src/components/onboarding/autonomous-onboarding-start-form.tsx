"use client";

import { useActionState } from "react";
import { startAutonomousOnboardingAction } from "@/app/(auth)/setup/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AutonomousOnboardingPlan = {
  key: string;
  name: string;
  description: string;
};

export function AutonomousOnboardingStartForm({
  plans,
  defaultCompanyName = "",
}: {
  plans: AutonomousOnboardingPlan[];
  defaultCompanyName?: string;
}) {
  const [state, action, pending] = useActionState(startAutonomousOnboardingAction, {});

  return (
    <form action={action} className="space-y-6">
      <ActionFeedback error={state.error} success={state.success} />

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Entreprise</h2>
          <p className="text-sm text-muted-foreground">Créez le tenant qui isolera les données de votre société et de votre marque.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="autonomous-legal-name">Raison sociale</Label>
            <Input id="autonomous-legal-name" name="legalName" defaultValue={defaultCompanyName} required placeholder="Laboratoires Exemple SAS" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autonomous-trade-name">Nom commercial</Label>
            <Input id="autonomous-trade-name" name="tradeName" defaultValue={defaultCompanyName} placeholder="Laboratoires Exemple" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autonomous-country">Pays</Label>
            <Input id="autonomous-country" name="countryCode" defaultValue="FR" maxLength={2} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autonomous-currency">Devise</Label>
            <Input id="autonomous-currency" name="currencyCode" defaultValue="EUR" maxLength={3} required />
          </div>
          <input type="hidden" name="timezone" value="Europe/Paris" />
          <input type="hidden" name="locale" value="fr-FR" />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Première marque</h2>
          <p className="text-sm text-muted-foreground">L’espace reste en brouillon jusqu’à la validation finale.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="autonomous-brand-name">Nom de la marque</Label>
            <Input id="autonomous-brand-name" name="brandName" required placeholder="Ma marque" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autonomous-brand-code">Code marque</Label>
            <Input id="autonomous-brand-code" name="brandCode" required placeholder="MARQUE" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autonomous-accent">Couleur principale</Label>
            <Input id="autonomous-accent" name="accentColor" type="color" defaultValue="#0b1e32" className="h-10 p-1" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="autonomous-description">Description courte</Label>
            <Input id="autonomous-description" name="description" maxLength={300} placeholder="Positionnement ou activité de la marque" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Plan TR1</h2>
          <p className="text-sm text-muted-foreground">Seuls les plans incluant l’onboarding autonome sont proposés.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((plan, index) => (
            <label key={plan.key} className="flex cursor-pointer gap-3 rounded-xl border p-4">
              <input type="radio" name="planKey" value={plan.key} defaultChecked={index === 0} required className="mt-1" />
              <span>
                <span className="block font-medium">{plan.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{plan.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <Button disabled={pending || plans.length === 0} className="w-full sm:w-auto">
        {pending ? "Création de l’espace…" : "Créer mon espace brouillon"}
      </Button>
    </form>
  );
}
