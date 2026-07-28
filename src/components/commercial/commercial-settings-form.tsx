"use client";

import { useActionState } from "react";
import { updateCommercialHealthSettingsAction } from "@/app/(protected)/dashboard/commercial-health/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CommercialSettingsForm({ settings }: { settings: Record<string, number> }) {
  const [state, action, pending] = useActionState(updateCommercialHealthSettingsAction, {});
  const fields = [
    ["defaultInterval", "default_reorder_interval_days", "Intervalle par défaut (jours)", "1"],
    ["firstReorder", "first_reorder_target_days", "Cible premier réassort (jours)", "1"],
    ["dueSoon", "reorder_due_soon_days", "Fenêtre bientôt attendu (jours)", "1"],
    ["atRisk", "at_risk_multiplier", "Multiplicateur à risque", "0.05"],
    ["dormant", "dormant_multiplier", "Multiplicateur dormant", "0.05"],
    ["eligibility", "reorder_eligibility_days", "Éligibilité KPI réassort (jours)", "1"],
  ];
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ActionFeedback {...state} /></div>
      {fields.map(([name, key, label, step]) => (
        <div key={name} className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <Input id={name} name={name} type="number" step={step} defaultValue={settings[key]} required />
        </div>
      ))}
      <Button disabled={pending} className="sm:col-span-2">{pending ? "Enregistrement…" : "Enregistrer les règles"}</Button>
    </form>
  );
}
