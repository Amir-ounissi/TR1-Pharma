"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createReorderFollowupAction } from "@/app/(protected)/dashboard/commercial-health/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPEN_ACTION_RECOMMENDATION } from "@/lib/commercial-health";

export function ReorderFollowupForm({
  brandPharmacyId,
  recommendation,
  compact = false,
}: {
  brandPharmacyId: string;
  recommendation: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(createReorderFollowupAction, {});
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const defaultDueAt = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T09:00`;

  if (recommendation === OPEN_ACTION_RECOMMENDATION) {
    return (
      <div className={compact ? "rounded-xl border bg-white p-3" : "rounded-xl border bg-muted/30 p-4"}>
        <p className="text-sm font-semibold text-[var(--tr1-navy)]">Action déjà planifiée</p>
        <p className="mt-1 text-xs text-muted-foreground">TR1 évite de créer une seconde relance tant que l’action ouverte n’est pas traitée.</p>
        <Button asChild variant="outline" className="mt-3 w-full">
          <Link href={`/dashboard/pharmacies/${brandPharmacyId}`}>Suivre l’action ouverte</Link>
        </Button>
      </div>
    );
  }

  return (
    <details className={compact ? "rounded-xl border bg-white p-3" : "rounded-xl border bg-muted/30 p-4"}>
      <summary className="cursor-pointer font-semibold text-[#176b45]">Créer la relance</summary>
      <form action={action} className="mt-4 grid gap-3">
        <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
        <ActionFeedback {...state} />
        <p className="text-sm text-muted-foreground">{recommendation}</p>
        <div className="space-y-2">
          <Label htmlFor={`due-${brandPharmacyId}`}>Échéance proposée</Label>
          <Input id={`due-${brandPharmacyId}`} name="dueAt" type="datetime-local" defaultValue={defaultDueAt} required />
        </div>
        <Button disabled={pending}>{pending ? "Création…" : "Confirmer la création"}</Button>
      </form>
    </details>
  );
}
