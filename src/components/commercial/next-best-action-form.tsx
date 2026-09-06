"use client";

import { useActionState } from "react";
import { createNextBestActionTaskAction } from "@/app/(protected)/dashboard/commercial-health/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NextBestActionType } from "@/lib/next-best-action";

export function NextBestActionForm({
  brandPharmacyId,
  actionType,
  actionLabel,
  suggestedDueAt,
}: {
  brandPharmacyId: string;
  actionType: NextBestActionType;
  actionLabel: string;
  suggestedDueAt: string;
}) {
  const [state, action, pending] = useActionState(createNextBestActionTaskAction, {});

  return (
    <details className="rounded-xl border bg-background p-3">
      <summary className="cursor-pointer font-semibold text-[#176b45]">Préparer l’action</summary>
      <form action={action} className="mt-4 grid gap-3">
        <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
        <input type="hidden" name="actionType" value={actionType} />
        <ActionFeedback {...state} />
        <p className="text-sm font-medium">{actionLabel}</p>
        <div className="space-y-2">
          <Label htmlFor={`nba-due-${brandPharmacyId}`}>Échéance proposée</Label>
          <Input
            id={`nba-due-${brandPharmacyId}`}
            name="dueAt"
            type="datetime-local"
            defaultValue={`${suggestedDueAt}T09:00`}
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">TR1 ne crée rien tant que vous n’avez pas confirmé.</p>
        <Button disabled={pending}>{pending ? "Création…" : "Confirmer la création"}</Button>
      </form>
    </details>
  );
}
