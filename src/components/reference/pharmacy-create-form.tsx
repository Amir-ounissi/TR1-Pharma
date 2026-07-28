"use client";

import { useActionState } from "react";
import { createPharmacyAction } from "@/app/(protected)/dashboard/reference/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { activityStatuses, commercialStatuses, labels, pharmacySources, potentialLevels, priorityLevels } from "@/lib/reference-data";

type Option = { id: string; name: string };

export function PharmacyCreateForm({ groups, territories, agents, existingPharmacies }: { groups: Option[]; territories: Option[]; agents: Option[]; existingPharmacies: Option[] }) {
  const [state, action, pending] = useActionState(createPharmacyAction, {});
  return <form action={action} className="space-y-6">
    <ActionFeedback error={state.error} success={state.success} />
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="existingPharmacyId">Rattacher une pharmacie physique existante</Label><Select name="existingPharmacyId"><SelectTrigger id="existingPharmacyId" className="w-full"><SelectValue placeholder="Créer une nouvelle pharmacie" /></SelectTrigger><SelectContent>{existingPharmacies.map((pharmacy) => <SelectItem key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="legalName">Raison sociale (création)</Label><Input id="legalName" name="legalName" /></div>
      <div className="space-y-2"><Label htmlFor="tradeName">Nom commercial</Label><Input id="tradeName" name="tradeName" /></div>
      <div className="space-y-2"><Label htmlFor="siret">SIRET</Label><Input id="siret" name="siret" inputMode="numeric" maxLength={14} /></div>
      <div className="space-y-2"><Label htmlFor="cipCode">Code CIP</Label><Input id="cipCode" name="cipCode" /></div>
      <div className="space-y-2"><Label htmlFor="finessCode">Code FINESS</Label><Input id="finessCode" name="finessCode" /></div>
      <div className="space-y-2"><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" type="tel" /></div>
      <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
      <div className="space-y-2"><Label htmlFor="website">Site web</Label><Input id="website" name="website" type="url" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="addressLine1">Adresse</Label><Input id="addressLine1" name="addressLine1" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="addressLine2">Complément</Label><Input id="addressLine2" name="addressLine2" /></div>
      <div className="space-y-2"><Label htmlFor="postalCode">Code postal</Label><Input id="postalCode" name="postalCode" /></div>
      <div className="space-y-2"><Label htmlFor="city">Ville</Label><Input id="city" name="city" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="pharmacyGroupId">Groupement</Label><Select name="pharmacyGroupId"><SelectTrigger id="pharmacyGroupId" className="w-full"><SelectValue placeholder="Aucun groupement" /></SelectTrigger><SelectContent>{groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select></div>
    </section>
    <section className="grid gap-4 border-t pt-6 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2"><Label>Statut commercial</Label><Select name="commercialStatus" defaultValue="targeted"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{commercialStatuses.map((value) => <SelectItem key={value} value={value}>{labels.commercialStatus[value]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Activité</Label><Select name="activityStatus" defaultValue="never_ordered"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{activityStatuses.map((value) => <SelectItem key={value} value={value}>{labels.activityStatus[value]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Priorité</Label><Select name="priorityLevel" defaultValue="normal"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorityLevels.map((value) => <SelectItem key={value} value={value}>{labels.priorityLevel[value]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Potentiel</Label><Select name="potentialLevel" defaultValue="unknown"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{potentialLevels.map((value) => <SelectItem key={value} value={value}>{labels.potentialLevel[value]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="potentialScore">Score potentiel</Label><Input id="potentialScore" name="potentialScore" type="number" min="0" max="100" /></div>
      <div className="space-y-2"><Label>Source</Label><Select name="source" defaultValue="tr1_prospecting"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{pharmacySources.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Territoire</Label><Select name="territoryId"><SelectTrigger className="w-full"><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{territories.map((territory) => <SelectItem key={territory.id} value={territory.id}>{territory.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Agent</Label><Select name="currentAgentUserId"><SelectTrigger className="w-full"><SelectValue placeholder="Non affecté" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" name="confirmDuplicate" value="true" className="size-4" /> Confirmer la création malgré un rapprochement potentiel par nom ou adresse.</label>
    </section>
    <Button disabled={pending}>{pending ? "Création…" : "Créer la pharmacie et la relation"}</Button>
  </form>;
}
