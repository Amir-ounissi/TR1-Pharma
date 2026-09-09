"use client";

import { useActionState } from "react";
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
  const agentMode = requesterRole === "agent";

  return (
    <form action={action} className="space-y-5">
      <ActionFeedback {...state} />

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle index="01" title="Où et quand" description={agentMode ? "La pharmacie doit appartenir à votre portefeuille actif." : "Définissez le point de vente et le créneau souhaité."} />
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
          <Field label="Début souhaité"><Input name="scheduledStartAt" type="datetime-local" required /></Field>
          <Field label="Fin souhaitée"><Input name="scheduledEndAt" type="datetime-local" required /></Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle index="02" title="Ce qu’on attend" description="Transformez le brief commercial en objectifs simples à exécuter sur le terrain." />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Titre"><Input name="title" placeholder="Animation gamme Anti-Stress" required /></Field>
          <Field label="Priorité">
            <select name="priority" defaultValue="normal" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option>
            </select>
          </Field>
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
        <SectionTitle index="03" title="Conditions" description="Les conditions sont visibles dans la mission et restent séparées des résultats terrain." />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Rémunération animateur HT"><Input name="providerCostHt" type="number" min="0" step="0.01" defaultValue="0" /></Field>
          <Field label="Frais déplacement prévus HT"><Input name="travelCostHt" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <SectionTitle index="04" title="Ce qui devra être prouvé" description="TR1 utilisera ces exigences pour contrôler la clôture de l’animation." />
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
          <p className="text-sm font-semibold">Demande d’animation encadrée</p>
          <p className="text-xs text-muted-foreground">L’animateur devra accepter avant exécution. Les preuves cochées conditionnent la clôture.</p>
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
