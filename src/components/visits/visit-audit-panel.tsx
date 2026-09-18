"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ClipboardCheck, PlusCircle } from "lucide-react";
import {
  createAuditRecommendationTaskAction,
  saveVisitAuditAction,
  type VisitAuditActionState,
} from "@/app/(protected)/dashboard/visits/audit-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type VisitAuditSnapshot = {
  id: string;
  price_displayed: boolean | null;
  displayed_price_ttc: number | string | null;
  availability_status: string;
  stock_quantity: number | null;
  stock_count_mode: string;
  facings: number | null;
  shelf_visibility: string;
  plv_present: boolean | null;
  team_training_status: string;
  tester_samples_status: string;
  competition_visible: boolean | null;
  competition_note: string | null;
  notes: string | null;
  recommendations: string[];
  audited_at: string;
};

const emptyState: VisitAuditActionState = {};

const recommendationLabels: Record<string, string> = {
  reorder: "Prévoir un réassort",
  price: "Contrôler le prix",
  plv: "Remettre la PLV",
  training: "Renforcer la formation",
  merchandising: "Corriger le merchandising",
  animation: "Étudier une animation",
  follow_up: "Suivre la concurrence",
};

const availabilityLabels: Record<string, string> = {
  available: "Disponible",
  low_stock: "Stock faible",
  stockout: "Rupture",
  unknown: "Non vérifié",
};

const visibilityLabels: Record<string, string> = {
  high: "Très visible",
  medium: "Correcte",
  low: "Faible",
  not_visible: "Non visible",
  unknown: "Non vérifiée",
};

const trainingLabels: Record<string, string> = {
  trained: "Équipe formée",
  reinforce: "À renforcer",
  not_trained: "Non formée",
  unknown: "Non vérifié",
};

function boolValue(value: boolean | null | undefined) {
  return value === true ? "true" : value === false ? "false" : "unknown";
}

function moneyValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

export function VisitAuditPanel({
  visitId,
  brandPharmacyId,
  brandName,
  currentAudit,
  previousAudit,
}: {
  visitId: string;
  brandPharmacyId: string;
  brandName: string;
  currentAudit: VisitAuditSnapshot | null;
  previousAudit: VisitAuditSnapshot | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveVisitAuditAction, emptyState);
  const seed = currentAudit ?? previousAudit;
  const prefilled = !currentAudit && Boolean(previousAudit);

  useEffect(() => {
    if (state.success && !state.warning) router.refresh();
  }, [state.success, state.warning, router]);

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <details open={!currentAudit}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-50">
                <ClipboardCheck className="size-4 text-[var(--tr1-orange)]" />
              </div>
              <div>
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
                  Audit express 4P+
                </p>
                <h2 className="mt-1 font-bold text-[var(--tr1-navy)]">{brandName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prix, stock, visibilité, PLV et équipe en moins de 2 minutes.
                </p>
              </div>
            </div>
            {currentAudit ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" /> Fait
              </span>
            ) : null}
          </div>
        </summary>

        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="visitId" value={visitId} />
          <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />

          {prefilled ? (
            <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              Prérempli depuis le dernier audit. Modifiez uniquement ce qui a changé.
            </p>
          ) : null}
          {state.error ? <Feedback tone="error">{state.error}</Feedback> : null}
          {state.warning ? <Feedback tone="warning">{state.warning}</Feedback> : null}
          {state.success ? <Feedback tone="success">{state.success}</Feedback> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Produit disponible ?">
              <select name="availabilityStatus" defaultValue={seed?.availability_status ?? "unknown"} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                <option value="available">Oui</option>
                <option value="low_stock">Stock faible</option>
                <option value="stockout">Rupture</option>
                <option value="unknown">Non vérifié</option>
              </select>
            </Field>

            <Field label="Stock">
              <div className="grid grid-cols-[1fr_8.5rem] gap-2">
                <Input name="stockQuantity" type="number" min="0" step="1" defaultValue={seed?.stock_quantity ?? ""} placeholder="Qté" />
                <select name="stockCountMode" defaultValue={seed?.stock_count_mode ?? "unknown"} className="h-10 rounded-md border bg-background px-2 text-sm">
                  <option value="counted">Compté</option>
                  <option value="estimated">Estimé</option>
                  <option value="unknown">Non vérifié</option>
                </select>
              </div>
            </Field>

            <Field label="Prix affiché ?">
              <div className="grid grid-cols-[8rem_1fr] gap-2">
                <select name="priceDisplayed" defaultValue={boolValue(seed?.price_displayed)} className="h-10 rounded-md border bg-background px-2 text-sm">
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                  <option value="unknown">Non vérifié</option>
                </select>
                <Input name="displayedPriceTtc" type="number" min="0" step="0.01" defaultValue={moneyValue(seed?.displayed_price_ttc)} placeholder="Prix TTC €" />
              </div>
            </Field>

            <Field label="Facings / visibilité">
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <Input name="facings" type="number" min="0" step="1" defaultValue={seed?.facings ?? ""} placeholder="Facings" />
                <select name="shelfVisibility" defaultValue={seed?.shelf_visibility ?? "unknown"} className="h-10 rounded-md border bg-background px-2 text-sm">
                  <option value="high">Très visible</option>
                  <option value="medium">Correcte</option>
                  <option value="low">Faible</option>
                  <option value="not_visible">Non visible</option>
                  <option value="unknown">Non vérifiée</option>
                </select>
              </div>
            </Field>

            <Field label="PLV présente ?">
              <select name="plvPresent" defaultValue={boolValue(seed?.plv_present)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="true">Oui</option>
                <option value="false">Non</option>
                <option value="unknown">Non vérifié</option>
              </select>
            </Field>

            <Field label="Équipe">
              <select name="teamTrainingStatus" defaultValue={seed?.team_training_status ?? "unknown"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="trained">Formée</option>
                <option value="reinforce">À renforcer</option>
                <option value="not_trained">Non formée</option>
                <option value="unknown">Non vérifié</option>
              </select>
            </Field>

            <Field label="Testeurs / échantillons">
              <select name="testerSamplesStatus" defaultValue={seed?.tester_samples_status ?? "unknown"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="present">Présents</option>
                <option value="missing">Manquants</option>
                <option value="not_applicable">Non pertinent</option>
                <option value="unknown">Non vérifié</option>
              </select>
            </Field>

            <Field label="Concurrence visible ?">
              <select name="competitionVisible" defaultValue={boolValue(seed?.competition_visible)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="true">Oui</option>
                <option value="false">Non</option>
                <option value="unknown">Non vérifié</option>
              </select>
            </Field>
          </div>

          <Field label="Remarque concurrence">
            <Input name="competitionNote" maxLength={1000} defaultValue={seed?.competition_note ?? ""} placeholder="Ex. concurrent en tête de gondole, promo visible…" />
          </Field>

          <Field label="Note rapide">
            <Textarea name="notes" maxLength={2000} rows={2} defaultValue={seed?.notes ?? ""} placeholder="Écart ou détail utile pour le prochain passage." />
          </Field>

          <div className="rounded-xl border border-dashed p-3">
            <Label htmlFor={`audit-photo-${brandPharmacyId}`} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Camera className="size-4 text-[var(--tr1-orange)]" />
              Photo preuve facultative
            </Label>
            <Input
              id={`audit-photo-${brandPharmacyId}`}
              name="auditPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="mt-2"
            />
          </div>

          <Button disabled={pending} className="min-h-11 w-full sm:w-auto">
            {pending ? "Enregistrement…" : currentAudit ? "Mettre à jour l’audit" : "Enregistrer l’audit"}
          </Button>
        </form>

        {currentAudit && previousAudit ? (
          <AuditComparison current={currentAudit} previous={previousAudit} />
        ) : null}

        {currentAudit?.recommendations?.length ? (
          <div className="mt-5 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-semibold text-[var(--tr1-navy)]">Actions proposées</p>
            <p className="mt-1 text-xs text-muted-foreground">
              TR1 propose. Vous choisissez ce qui devient une vraie tâche.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentAudit.recommendations.map((code) => (
                <RecommendationButton key={code} auditId={currentAudit.id} code={code} />
              ))}
            </div>
          </div>
        ) : null}
      </details>
    </section>
  );
}

function RecommendationButton({ auditId, code }: { auditId: string; code: string }) {
  const [state, action, pending] = useActionState(createAuditRecommendationTaskAction, emptyState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="auditId" value={auditId} />
      <input type="hidden" name="code" value={code} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <PlusCircle className="size-3.5" />
        {pending ? "Ajout…" : recommendationLabels[code] ?? code}
      </Button>
      {state.success ? <p className="text-[0.65rem] text-emerald-700">{state.success}</p> : null}
      {state.error ? <p className="text-[0.65rem] text-red-700">{state.error}</p> : null}
    </form>
  );
}

function AuditComparison({ current, previous }: { current: VisitAuditSnapshot; previous: VisitAuditSnapshot }) {
  const rows = [
    ["Disponibilité", availabilityLabels[current.availability_status] ?? current.availability_status, availabilityLabels[previous.availability_status] ?? previous.availability_status],
    ["Stock", current.stock_quantity ?? "—", previous.stock_quantity ?? "—"],
    ["Facings", current.facings ?? "—", previous.facings ?? "—"],
    ["Visibilité", visibilityLabels[current.shelf_visibility] ?? current.shelf_visibility, visibilityLabels[previous.shelf_visibility] ?? previous.shelf_visibility],
    ["PLV", current.plv_present === true ? "Oui" : current.plv_present === false ? "Non" : "—", previous.plv_present === true ? "Oui" : previous.plv_present === false ? "Non" : "—"],
    ["Équipe", trainingLabels[current.team_training_status] ?? current.team_training_status, trainingLabels[previous.team_training_status] ?? previous.team_training_status],
  ];

  return (
    <div className="mt-5 rounded-xl border p-4">
      <p className="text-sm font-semibold text-[var(--tr1-navy)]">Depuis le passage précédent</p>
      <div className="mt-3 grid gap-2 text-xs">
        {rows.map(([label, now, before]) => (
          <div key={String(label)} className="grid grid-cols-[1fr_auto] gap-3 border-b pb-2 last:border-0 last:pb-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{String(before)} → {String(now)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Feedback({ children, tone }: { children: React.ReactNode; tone: "error" | "success" | "warning" }) {
  const className = tone === "error"
    ? "rounded-lg bg-red-50 p-3 text-sm text-red-700"
    : tone === "warning"
      ? "rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
      : "rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700";
  return <p className={className}>{children}</p>;
}
