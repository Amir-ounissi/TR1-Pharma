"use client";

import { useActionState, useState } from "react";
import { createAnimationRequestAction } from "@/app/(protected)/dashboard/missions/animation-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = {
  id: string;
  label: string;
  detail?: string;
};

type FacilitatorOption = {
  id: string;
  label: string;
};

type RemunerationModel = "fixed" | "tiered";

type TierRow = {
  id: number;
  min: string;
  max: string;
  amount: string;
};

const initialTiers: TierRow[] = [
  { id: 1, min: "0", max: "10", amount: "" },
  { id: 2, min: "11", max: "20", amount: "" },
  { id: 3, min: "21", max: "", amount: "" },
];

export function AnimationRequestForm({
  pharmacies,
  products,
  facilitators,
  requesterRole,
}: {
  pharmacies: Option[];
  products: Option[];
  facilitators: FacilitatorOption[];
  requesterRole: string;
}) {
  const [state, action, pending] = useActionState(createAnimationRequestAction, {});
  const [remunerationModel, setRemunerationModel] = useState<RemunerationModel>("fixed");
  const [tiers, setTiers] = useState<TierRow[]>(initialTiers);
  const agentMode = requesterRole === "agent";

  function updateTier(id: number, key: "min" | "max" | "amount", value: string) {
    setTiers((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  function addTier() {
    setTiers((rows) => {
      const last = rows.at(-1);
      const nextMin = last?.max && /^\d+$/.test(last.max) ? String(Number(last.max) + 1) : "";
      return [...rows, { id: Date.now(), min: nextMin, max: "", amount: "" }];
    });
  }

  return (
    <form action={action} className="space-y-5">
      <ActionFeedback {...state} />

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle
          index="01"
          title="Cadre de la demande"
          description={agentMode ? "Choisissez une pharmacie de votre portefeuille et le rythme d’animation attendu." : "Définissez le point de vente, le rythme mensuel et la période de démarrage."}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Pharmacie">
            <select name="brandPharmacyId" required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Choisir une pharmacie</option>
              {pharmacies.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}{item.detail ? ` · ${item.detail}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Animateur sollicité">
            <select name="assignedUserId" defaultValue="" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">À affecter ensuite</option>
              {facilitators.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Journées d’animation par mois">
            <Input name="daysPerMonth" type="number" min="1" max="31" step="1" defaultValue="1" required />
          </Field>
          <Field label="À partir de quel mois ?">
            <Input name="startMonth" type="month" required />
          </Field>
          <Field label="Jusqu’à quel mois ? (facultatif)">
            <Input name="endMonth" type="month" />
          </Field>
          <Field label="Priorité">
            <select name="priority" defaultValue="normal" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option>
            </select>
          </Field>
        </div>
        <p className="mt-3 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          La marque ou le commercial ne fixe aucune date à ce stade. Après acceptation, l’animateur positionnera les journées une par une et TR1 suivra le quota mensuel.
        </p>
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle index="02" title="Ce qu’on attend" description="Transformez le brief commercial en objectifs simples à exécuter sur le terrain." />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Titre"><Input name="title" placeholder="Animation gamme Anti-Stress" required /></Field>
          <div className="md:col-span-2"><Field label="Objectif principal"><Textarea name="objective" placeholder="Ex. générer 25 ventes et faire découvrir la gamme aux clients de la pharmacie." required /></Field></div>
          <div className="md:col-span-2"><Field label="Consignes / argument prioritaire"><Textarea name="briefing" className="min-h-28" placeholder="Message à pousser, offre du moment, points de vigilance, contact pharmacie…" /></Field></div>
        </div>

        <div className="mt-5">
          <Label>Produits et objectifs</Label>
          <p className="mt-1 text-xs text-muted-foreground">Cochez les références à travailler. L’objectif par produit est facultatif.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {products.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input type="checkbox" name="productId" value={item.id} className="mt-1" />
                  <span>{item.label}{item.detail ? <span className="block text-xs font-normal text-muted-foreground">{item.detail}</span> : null}</span>
                </label>
                <div className="mt-3 grid grid-cols-[8rem_1fr] gap-2">
                  <Input name={`productTarget:${item.id}`} type="number" min="0" step="1" placeholder="Objectif unités" />
                  <Input name={`productBrief:${item.id}`} placeholder="Consigne produit" />
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name={`productPriority:${item.id}`} /> Produit prioritaire
                </label>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle index="03" title="Rémunération" description="Le mode choisi est attaché à la demande et repris sur chaque journée planifiée." />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Système de rémunération">
            <select
              name="remunerationModel"
              value={remunerationModel}
              onChange={(event) => setRemunerationModel(event.target.value as RemunerationModel)}
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="fixed">Montant fixe par journée</option>
              <option value="tiered">Rémunération par paliers de ventes</option>
            </select>
          </Field>
          <Field label="Frais déplacement prévus HT / journée">
            <Input name="travelCostHt" type="number" min="0" step="0.01" defaultValue="0" />
          </Field>
        </div>

        {remunerationModel === "fixed" ? (
          <div className="mt-4 max-w-md">
            <Field label="Montant fixe HT par journée">
              <Input name="fixedAmountHt" type="number" min="0" step="0.01" defaultValue="0" required />
            </Field>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
              <span>À partir de</span><span>Jusqu’à</span><span>Montant HT</span><span className="w-20" />
            </div>
            {tiers.map((tier, index) => (
              <div key={tier.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input name="tierMin" type="number" min="0" step="1" value={tier.min} onChange={(event) => updateTier(tier.id, "min", event.target.value)} required />
                <Input name="tierMax" type="number" min="0" step="1" value={tier.max} onChange={(event) => updateTier(tier.id, "max", event.target.value)} placeholder="et +" />
                <Input name="tierAmountHt" type="number" min="0" step="0.01" value={tier.amount} onChange={(event) => updateTier(tier.id, "amount", event.target.value)} required />
                <Button
                  type="button"
                  variant="outline"
                  className="w-20"
                  disabled={tiers.length === 1}
                  onClick={() => setTiers((rows) => rows.filter((row) => row.id !== tier.id))}
                  aria-label={`Supprimer le palier ${index + 1}`}
                >
                  Retirer
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addTier}>Ajouter un palier</Button>
            <p className="text-xs text-muted-foreground">Laissez « Jusqu’à » vide sur le dernier palier pour signifier « et plus ».</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle index="04" title="Ce qui devra être prouvé" description="TR1 utilisera ces exigences pour contrôler chaque journée d’animation." />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Requirement name="merchPlanRequired" label="Photo du plan merchandising" defaultChecked />
          <Requirement name="merchResultRequired" label="Photo du résultat merchandising" defaultChecked />
          <Requirement name="cashRegisterRequired" label="Sortie de caisse photo / PDF" defaultChecked />
          <Requirement name="salesByProductRequired" label="Ventes par produit" defaultChecked />
          <Requirement name="beforeAfterRequired" label="Photos avant + après" />
          <div className="flex items-center gap-3 rounded-lg border bg-muted/25 p-3 text-sm">
            <input type="checkbox" checked readOnly />
            <span><strong>Compte rendu</strong><span className="block text-xs text-muted-foreground">Toujours obligatoire</span></span>
          </div>
        </div>
      </section>

      <div className="sticky bottom-3 z-10 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur sm:flex sm:items-center sm:justify-between">
        <div className="mb-3 sm:mb-0">
          <p className="text-sm font-semibold">Demande d’animation mensuelle</p>
          <p className="text-xs text-muted-foreground">L’animateur accepte d’abord la demande. Les dates seront ensuite suivies séparément par mois.</p>
        </div>
        <Button disabled={pending} className="w-full sm:w-auto">
          {pending ? "Envoi…" : facilitators.length ? "Envoyer la demande" : "Créer et affecter ensuite"}
        </Button>
      </div>
    </form>
  );
}

function SectionTitle({ index, title, description }: { index: string; title: string; description: string }) {
  return <div className="flex gap-3"><span className="font-mono text-xs font-bold text-[var(--tr1-orange)]">{index}</span><div><h2 className="font-semibold text-[var(--tr1-navy)]">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div></div>;
}

function Requirement({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} /><span>{label}</span></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
