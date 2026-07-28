"use client";

import { useActionState } from "react";
import { createReorderFollowupAction } from "@/app/(protected)/dashboard/commercial-health/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
