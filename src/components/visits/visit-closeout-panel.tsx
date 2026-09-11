"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, Sparkles } from "lucide-react";
import {
  closeFieldVisitAction,
  startFieldVisitAction,
  type VisitCloseoutActionState,
} from "@/app/(protected)/dashboard/visits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyState: VisitCloseoutActionState = {};

export function VisitCloseoutPanel({
  visitId,
  status,
  closeout,
}: {
  visitId: string;
  status: string;
  closeout: {
    outcome: string;
    summary: string;
    input_mode: string;
    completed_at: string;
    next_visit_id: string | null;
  } | null;
}) {
  const router = useRouter();
  const [startState, startAction, starting] = useActionState(startFieldVisitAction, emptyState);
  const [closeState, closeAction, closing] = useActionState(closeFieldVisitAction, emptyState);

  useEffect(() => {
    if (startState.success || closeState.success) router.refresh();
  }, [startState.success, closeState.success, router]);

  if (status === "completed" || closeout) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
          <div className="min-w-0">
            <h2 className="font-bold text-emerald-950">Visite clôturée</h2>
            {closeout ? (
              <>
                <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-950/80">{closeout.summary}</p>
                <p className="mt-3 text-xs text-emerald-900/60">
                  Saisie via {closeout.input_mode === "assistant" ? "assistant IA" : closeout.input_mode === "dictation" ? "dictée" : "formulaire"}.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (["planned", "confirmed"].includes(status)) {
    return (
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[var(--tr1-navy)]">Exécuter la visite</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Démarrez la visite au moment d’entrer en pharmacie. TR1 distinguera ainsi une visite planifiée d’une visite réellement exécutée.
        </p>
        <form action={startAction} className="mt-4">
          <input type="hidden" name="visitId" value={visitId} />
          {startState.error ? <Feedback tone="error">{startState.error}</Feedback> : null}
          <Button disabled={starting} className="w-full sm:w-auto">
            <Play className="size-4" />
            {starting ? "Démarrage…" : "Démarrer la visite"}
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-50">
          <Sparkles className="size-4 text-[var(--tr1-orange)]" />
        </div>
        <div>
          <h2 className="font-bold text-[var(--tr1-navy)]">Clôturer sans ressaisie inutile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un résultat, un compte rendu court, puis éventuellement la prochaine visite. Ce même contrat pourra être prérempli par dictée ou par l’assistant IA.
          </p>
        </div>
      </div>

      <form action={closeAction} className="mt-5 space-y-4">
        <input type="hidden" name="visitId" value={visitId} />
        <input type="hidden" name="inputMode" value="manual" />

        {closeState.error ? <Feedback tone="error">{closeState.error}</Feedback> : null}
        {closeState.success ? <Feedback tone="success">{closeState.success}</Feedback> : null}

        <div>
          <Label className="mb-1.5">Résultat</Label>
          <select name="outcome" defaultValue="no_order" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="order_taken">Commande prise</option>
            <option value="no_order">Pas de commande</option>
            <option value="follow_up">À relancer</option>
            <option value="information">Information / suivi</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div>
          <Label className="mb-1.5">Compte rendu</Label>
          <Textarea
            name="summary"
            required
            rows={5}
            placeholder="Ex. Référencement validé sur 3 références. Équipe formée. Revoir la pharmacie après les premières sorties."
          />
        </div>

        <details className="rounded-xl border px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--tr1-navy)]">
            Planifier la prochaine visite
          </summary>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="mb-1.5">Date et heure</Label>
              <Input type="datetime-local" name="nextVisitAt" />
            </div>
            <div>
              <Label className="mb-1.5">Objectif de la prochaine visite</Label>
              <Textarea name="nextObjective" rows={3} placeholder="Optionnel" />
            </div>
            <p className="text-xs text-muted-foreground">
              Si une date est renseignée, TR1 crée directement une vraie visite dans l’Agenda — pas une simple tâche.
            </p>
          </div>
        </details>

        <Button disabled={closing} className="w-full sm:w-auto">
          <CheckCircle2 className="size-4" />
          {closing ? "Clôture…" : "Clôturer la visite"}
        </Button>
      </form>
    </section>
  );
}

function Feedback({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <p className={tone === "error" ? "rounded-lg bg-red-50 p-3 text-sm text-red-700" : "rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"}>
      {children}
    </p>
  );
}
