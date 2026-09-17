"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CalendarPlus, Zap } from "lucide-react";
import { createFieldVisitAction } from "@/app/(protected)/dashboard/agenda/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type VisitPharmacyOption = {
  id: string;
  label: string;
  city?: string;
  brands: Array<{
    relationId: string;
    brandId: string;
    brandName: string;
  }>;
};

export function FieldVisitCreateForm({
  pharmacies,
  defaultStart,
  defaultPharmacyId,
  defaultBrandId,
  defaultObjective,
  quick = false,
}: {
  pharmacies: VisitPharmacyOption[];
  defaultStart: string;
  defaultPharmacyId?: string;
  defaultBrandId?: string;
  defaultObjective?: string;
  quick?: boolean;
}) {
  const initialPharmacy =
    pharmacies.find((item) => item.id === defaultPharmacyId) ?? pharmacies[0];
  const [state, action, pending] = useActionState(
    createFieldVisitAction,
    {} as { error?: string; success?: string },
  );
  const [pharmacyId, setPharmacyId] = useState(initialPharmacy?.id ?? "");
  const [title, setTitle] = useState(
    initialPharmacy ? `Visite · ${initialPharmacy.label}` : "Visite terrain",
  );
  const selected = pharmacies.find((item) => item.id === pharmacyId);
  const selectedDefaultBrandId = selected?.brands.some(
    (brand) => brand.brandId === defaultBrandId,
  )
    ? defaultBrandId
    : selected?.brands[0]?.brandId;
  const selectedDefaultRelation = selected?.brands.find(
    (brand) => brand.brandId === selectedDefaultBrandId,
  ) ?? selected?.brands[0];

  if (!pharmacies.length) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Aucune pharmacie active n’est disponible pour planifier une visite.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      {quick ? (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <Zap className="mt-0.5 size-4 shrink-0 text-[var(--tr1-orange)]" />
          <div>
            <p className="text-sm font-bold text-[var(--tr1-navy)]">Ajout rapide</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Choisis la pharmacie et le type de visite. TR1 utilise l’heure actuelle et un créneau de 30 minutes.
            </p>
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <div role="status" className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>{state.success}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/agent">Retour à Ma journée</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/agenda">Voir l’Agenda</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="visit-pharmacy">Pharmacie</Label>
        <select
          id="visit-pharmacy"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          name="pharmacyId"
          value={pharmacyId}
          onChange={(event) => {
            const nextId = event.target.value;
            const next = pharmacies.find((item) => item.id === nextId);
            setPharmacyId(nextId);
            if (next) setTitle(`Visite · ${next.label}`);
          }}
        >
          {pharmacies.map((item) => (
            <option value={item.id} key={item.id}>
              {item.label}{item.city ? ` · ${item.city}` : ""}
            </option>
          ))}
        </select>
      </div>

      {quick ? (
        <>
          <input type="hidden" name="brandPharmacyId" value={selectedDefaultRelation?.relationId ?? ""} />
          <input type="hidden" name="duration" value="30" />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="startAt" value={defaultStart} />
          <input type="hidden" name="objective" value={defaultObjective ?? ""} />
          <input type="hidden" name="notes" value="" />

          {selected && selected.brands.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="quick-brand">Marque</Label>
              <p className="text-xs text-muted-foreground">
                La marque active est sélectionnée automatiquement. Passe par la planification complète pour une visite multimarque.
              </p>
              <div id="quick-brand" className="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
                {selectedDefaultRelation?.brandName ?? "Marque active"}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="visit-kind">Type de visite</Label>
            <select id="visit-kind" className="h-11 w-full rounded-md border bg-background px-3 text-sm" name="visitKind" defaultValue="client_visit">
              <option value="client_visit">Visite client</option>
              <option value="prospecting">Prospection</option>
              <option value="relationship">Relation</option>
              <option value="training">Formation</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Marque concernée</Label>
            <div className="grid gap-2">
              {selected?.brands.map((brand) => (
                <label
                  className="flex min-h-10 items-center gap-3 rounded-md border px-3 text-sm"
                  key={`${pharmacyId}:${brand.relationId}`}
                >
                  <input
                    type="checkbox"
                    name="brandPharmacyId"
                    value={brand.relationId}
                    defaultChecked={brand.brandId === selectedDefaultBrandId}
                  />
                  <span className="min-w-0 truncate">{brand.brandName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="visit-kind">Type</Label>
              <select id="visit-kind" className="h-11 w-full rounded-md border bg-background px-3 text-sm" name="visitKind" defaultValue="client_visit">
                <option value="client_visit">Visite client</option>
                <option value="prospecting">Prospection</option>
                <option value="relationship">Relation</option>
                <option value="training">Formation</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visit-duration">Durée</Label>
              <select id="visit-duration" className="h-11 w-full rounded-md border bg-background px-3 text-sm" name="duration" defaultValue="60">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
                <option value="120">2 h</option>
                <option value="240">4 h</option>
                <option value="480">8 h</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-title">Titre</Label>
            <Input id="visit-title" name="title" required value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-start">Date et heure</Label>
            <Input id="visit-start" type="datetime-local" name="startAt" required defaultValue={defaultStart} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-objective">Objectif</Label>
            <Textarea
              id="visit-objective"
              name="objective"
              defaultValue={defaultObjective}
              placeholder="Ex. présenter la nouveauté, contrôler le stock, obtenir un réassort…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-notes">Notes</Label>
            <Textarea id="visit-notes" name="notes" placeholder="Informations utiles avant la visite" />
          </div>
        </>
      )}

      <Button disabled={pending || !selectedDefaultRelation} className="min-h-12 w-full text-sm font-bold">
        <CalendarPlus className="size-4" />
        {pending ? "Ajout en cours…" : quick ? "Ajouter maintenant" : "Ajouter la visite"}
      </Button>

      {quick ? (
        <Button asChild type="button" variant="ghost" className="w-full">
          <Link href="/dashboard/agenda/new">Planification complète</Link>
        </Button>
      ) : null}
    </form>
  );
}
