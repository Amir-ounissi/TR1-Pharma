"use client";

import { useActionState } from "react";
import { Target } from "lucide-react";
import {
  savePersonalMonthlyTargetAction,
  type PersonalMonthlyTargetActionState,
} from "@/app/(protected)/dashboard/agent/performance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PersonalMonthlyTargetActionState = {};

export function AgentMonthlyTargetForm({
  brandId,
  monthStart,
  currentTarget,
  compact = false,
}: {
  brandId: string;
  monthStart: string;
  currentTarget: number | null;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    savePersonalMonthlyTargetAction,
    initialState,
  );

  return (
    <form
      action={action}
      className={
        compact
          ? "rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-sm"
          : "rounded-xl border border-[var(--tr1-line)] bg-white p-5"
      }
    >
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="monthStart" value={monthStart} />

      <div className="flex items-start gap-3">
        <Target className="mt-0.5 size-5 shrink-0 text-[var(--tr1-orange)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--tr1-navy)]">
            {currentTarget == null ? "Définir mon objectif du mois" : "Mon objectif personnel du mois"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Utilisé uniquement si la marque ne t’a pas attribué d’objectif officiel.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="personal-month-target" className="mb-1.5">
            Objectif CA HT
          </Label>
          <div className="relative">
            <Input
              id="personal-month-target"
              name="targetValue"
              type="number"
              min="1"
              max="100000000"
              step="1"
              required
              defaultValue={currentTarget ?? undefined}
              className="min-h-11 pr-9 text-base sm:text-sm"
              placeholder="Ex. 25000"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              €
            </span>
          </div>
        </div>
        <Button disabled={pending} className="min-h-11 sm:min-w-32">
          {pending ? "Enregistrement…" : currentTarget == null ? "Définir" : "Mettre à jour"}
        </Button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}
