"use client";

import { useActionState } from "react";
import { addBrandPharmacyProductAction, createContactAction, createGroupAction, createProductAction, createTerritoryAction, updateBrandPharmacyAction, updateGroupAction, updateProductAction, updateTerritoryAction } from "@/app/(protected)/dashboard/reference/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { activityStatuses, commercialStatuses, labels, pharmacySources, potentialLevels, priorityLevels } from "@/lib/reference-data";

export function ContactForm({ pharmacyId }: { pharmacyId: string }) {
  const [state, action, pending] = useActionState(createContactAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="pharmacyId" value={pharmacyId} /><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Prénom</Label><Input name="firstName" required /></div><div className="space-y-2"><Label>Nom</Label><Input name="lastName" required /></div><div className="space-y-2"><Label>Fonction</Label><Input name="jobTitle" /></div><div className="space-y-2"><Label>Email</Label><Input name="email" type="email" /></div><div className="space-y-2"><Label>Téléphone</Label><Input name="phone" type="tel" /></div><label className="flex items-center gap-2 pt-8 text-sm"><input name="isPrimary" type="checkbox" className="size-4" /> Contact principal</label><Button disabled={pending} className="sm:col-span-2">Ajouter le contact</Button></form>;
}

export function ProductForm() {
  const [state, action, pending] = useActionState(createProductAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Nom</Label><Input name="name" required /></div><div className="space-y-2"><Label>SKU</Label><Input name="sku" required /></div><div className="space-y-2"><Label>EAN</Label><Input name="ean" /></div><div className="space-y-2"><Label>Catégorie</Label><Input name="category" /></div><div className="space-y-2"><Label>Famille</Label><Input name="productFamily" /></div><div className="space-y-2"><Label>Format</Label><Input name="format" /></div><div className="space-y-2 sm:col-span-2"><Label>Description</Label><Textarea name="description" rows={3} /></div><div className="space-y-2"><Label>Prix pharmacie HT</Label><Input name="wholesalePrice" type="number" step="0.01" min="0" /></div><div className="space-y-2"><Label>PVC TTC recommandé</Label><Input name="retailPrice" type="number" step="0.01" min="0" /></div><div className="space-y-2"><Label>TVA (%)</Label><Input name="taxRate" type="number" step="0.01" min="0" max="100" /></div><div className="space-y-2"><Label>Colisage</Label><Input name="unitsPerCase" type="number" min="1" step="1" /></div><div className="space-y-2"><Label>MOQ</Label><Input name="minimumOrderQuantity" type="number" min="1" step="1" /></div><div className="space-y-2"><Label>Priorité stratégique</Label><Select name="strategicPriority" defaultValue="standard"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="priority">Prioritaire</SelectItem><SelectItem value="strategic">Stratégique</SelectItem></SelectContent></Select></div><label className="flex items-center gap-2 text-sm"><input name="pharmacyEligible" type="checkbox" defaultChecked /> Éligible pharmacie</label><label className="flex items-center gap-2 text-sm"><input name="countsForDistribution" type="checkbox" defaultChecked /> Compte dans la DN</label><Button disabled={pending} className="sm:col-span-2">Créer le produit</Button></form>;
}


export function ProductEditForm({
  product,
}: {
  product: {
    id: string;
    name: string;
    sku: string;
    ean: string | null;
    category: string | null;
    product_family: string | null;
    format: string | null;
    description: string | null;
    wholesale_price_ht: number | string | null;
    retail_price_ttc: number | string | null;
    tax_rate: number | string | null;
    units_per_case: number | null;
    minimum_order_quantity: number | null;
    strategic_priority: string;
    is_pharmacy_eligible: boolean;
    counts_for_distribution: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    updateProductAction,
    {},
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={product.id} />

      <div className="sm:col-span-2">
        <ActionFeedback {...state} />
      </div>

      <div className="space-y-2">
        <Label>Nom</Label>
        <Input name="name" defaultValue={product.name} required />
      </div>

      <div className="space-y-2">
        <Label>SKU / ACL</Label>
        <Input name="sku" defaultValue={product.sku} required />
      </div>

      <div className="space-y-2">
        <Label>EAN</Label>
        <Input name="ean" defaultValue={product.ean ?? ""} />
      </div>

      <div className="space-y-2">
        <Label>Format / conditionnement</Label>
        <Input name="format" defaultValue={product.format ?? ""} />
      </div>

      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Input name="category" defaultValue={product.category ?? ""} />
      </div>

      <div className="space-y-2">
        <Label>Famille</Label>
        <Input
          name="productFamily"
          defaultValue={product.product_family ?? ""}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>Description</Label>
        <Textarea
          name="description"
          rows={4}
          defaultValue={product.description ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label>Prix pharmacie HT</Label>
        <Input
          name="wholesalePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={product.wholesale_price_ht ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label>PVC TTC recommandé</Label>
        <Input
          name="retailPrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={product.retail_price_ttc ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label>TVA (%)</Label>
        <Input
          name="taxRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={product.tax_rate ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label>PCB / colisage</Label>
        <Input
          name="unitsPerCase"
          type="number"
          min="1"
          step="1"
          defaultValue={product.units_per_case ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Nombre d’unités par carton.
        </p>
      </div>

      <div className="space-y-2">
        <Label>MOQ</Label>
        <Input
          name="minimumOrderQuantity"
          type="number"
          min="1"
          step="1"
          defaultValue={product.minimum_order_quantity ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Quantité minimale de commande.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Priorité stratégique</Label>
        <Select
          name="strategicPriority"
          defaultValue={product.strategic_priority}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="priority">Prioritaire</SelectItem>
            <SelectItem value="strategic">Stratégique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="pharmacyEligible"
          type="checkbox"
          className="size-4"
          defaultChecked={product.is_pharmacy_eligible}
        />
        Éligible pharmacie
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="countsForDistribution"
          type="checkbox"
          className="size-4"
          defaultChecked={product.counts_for_distribution}
        />
        Compte dans la DN
      </label>

      <Button disabled={pending} className="sm:col-span-2">
        {pending
          ? "Enregistrement…"
          : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}

export function AddImplantedProductForm({ brandPharmacyId, products }: { brandPharmacyId: string; products: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(addBrandPharmacyProductAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="brandPharmacyId" value={brandPharmacyId} /><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Produit</Label><Select name="productId" required><SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Statut</Label><Select name="status" defaultValue="planned"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Planifié</SelectItem><SelectItem value="implanted">Implanté</SelectItem><SelectItem value="active">Actif</SelectItem><SelectItem value="temporarily_unavailable">Indisponible</SelectItem></SelectContent></Select></div><Button disabled={pending} className="sm:col-span-2">Ajouter le produit</Button></form>;
}

export function RelationForm({ relation, territories, agents }: { relation: Record<string, string | number | null>; territories: Array<{ id: string; name: string }>; agents: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(updateBrandPharmacyAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={String(relation.id)} /><div className="sm:col-span-2"><ActionFeedback {...state} /></div>
    <div className="space-y-2"><Label>Statut</Label><Select name="commercialStatus" defaultValue={String(relation.commercial_status)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{commercialStatuses.map((value) => <SelectItem key={value} value={value}>{labels.commercialStatus[value]}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Activité</Label><Select name="activityStatus" defaultValue={String(relation.activity_status)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{activityStatuses.map((value) => <SelectItem key={value} value={value}>{labels.activityStatus[value]}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Priorité</Label><Select name="priorityLevel" defaultValue={String(relation.priority_level)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorityLevels.map((value) => <SelectItem key={value} value={value}>{labels.priorityLevel[value]}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Potentiel</Label><Select name="potentialLevel" defaultValue={String(relation.potential_level)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{potentialLevels.map((value) => <SelectItem key={value} value={value}>{labels.potentialLevel[value]}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Score potentiel</Label><Input name="potentialScore" type="number" min="0" max="100" defaultValue={relation.potential_score ?? ""} /></div>
    <div className="space-y-2"><Label>Source</Label><Select name="source" defaultValue={String(relation.source)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{pharmacySources.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Agent</Label><Select name="currentAgentUserId" defaultValue={String(relation.current_agent_user_id ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Non affecté" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Territoire</Label><Select name="territoryId" defaultValue={String(relation.territory_id ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{territories.map((territory) => <SelectItem key={territory.id} value={territory.id}>{territory.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Prochaine action</Label><Input name="nextActionType" defaultValue={String(relation.next_action_type ?? "")} /></div><div className="space-y-2"><Label>Date de la prochaine action</Label><Input name="nextActionAt" type="datetime-local" /></div>
    <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" defaultValue={String(relation.notes ?? "")} /></div><Button disabled={pending} className="sm:col-span-2">Enregistrer</Button></form>;
}

export function GroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Nom</Label><Input name="name" required /></div><div className="space-y-2"><Label>Type</Label><Select name="groupType" defaultValue="other"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="national_group">Groupement national</SelectItem><SelectItem value="regional_group">Groupement régional</SelectItem><SelectItem value="banner">Enseigne</SelectItem><SelectItem value="network">Réseau</SelectItem><SelectItem value="wholesaler_distributor">Grossiste-répartiteur</SelectItem><SelectItem value="independent">Indépendant</SelectItem><SelectItem value="other">Autre</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Site web</Label><Input name="website" type="url" /></div><div className="space-y-2"><Label>Ville du siège</Label><Input name="headquartersCity" /></div><div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" /></div><Button disabled={pending} className="sm:col-span-2">Créer</Button></form>;
}

export function TerritoryForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(createTerritoryAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="organizationId" value={organizationId} /><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Nom</Label><Input name="name" required /></div><div className="space-y-2"><Label>Type</Label><Select name="territoryType" defaultValue="custom"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="country">Pays</SelectItem><SelectItem value="region">Région</SelectItem><SelectItem value="department">Département</SelectItem><SelectItem value="postal_area">Zone postale</SelectItem><SelectItem value="custom">Personnalisé</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Code région</Label><Input name="regionCode" /></div><div className="space-y-2"><Label>Code département</Label><Input name="departmentCode" /></div><div className="space-y-2 sm:col-span-2"><Label>Codes postaux (séparés par des virgules)</Label><Input name="postalCodes" /></div><Button disabled={pending} className="sm:col-span-2">Créer</Button></form>;
}

export function GroupEditForm({ group }: { group: { id: string; name: string; group_type: string; website: string | null; headquarters_city: string | null; notes: string | null } }) {
  const [state, action, pending] = useActionState(updateGroupAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={group.id} /><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Nom</Label><Input name="name" defaultValue={group.name} required /></div><div className="space-y-2"><Label>Type</Label><Select name="groupType" defaultValue={group.group_type}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="national_group">Groupement national</SelectItem><SelectItem value="regional_group">Groupement régional</SelectItem><SelectItem value="banner">Enseigne</SelectItem><SelectItem value="network">Réseau</SelectItem><SelectItem value="wholesaler_distributor">Grossiste-répartiteur</SelectItem><SelectItem value="independent">Indépendant</SelectItem><SelectItem value="other">Autre</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Site web</Label><Input name="website" type="url" defaultValue={group.website ?? ""} /></div><div className="space-y-2"><Label>Ville du siège</Label><Input name="headquartersCity" defaultValue={group.headquarters_city ?? ""} /></div><div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" defaultValue={group.notes ?? ""} /></div><Button disabled={pending} className="sm:col-span-2">Enregistrer</Button></form>;
}

export function TerritoryEditForm({ territory }: { territory: { id: string; name: string; territory_type: string; region_code: string | null; department_code: string | null; postal_codes: string[] | null } }) {
  const [state, action, pending] = useActionState(updateTerritoryAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={territory.id} /><div className="sm:col-span-2"><ActionFeedback {...state} /></div><div className="space-y-2"><Label>Nom</Label><Input name="name" defaultValue={territory.name} required /></div><div className="space-y-2"><Label>Type</Label><Select name="territoryType" defaultValue={territory.territory_type}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="country">Pays</SelectItem><SelectItem value="region">Région</SelectItem><SelectItem value="department">Département</SelectItem><SelectItem value="postal_area">Zone postale</SelectItem><SelectItem value="custom">Personnalisé</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Code région</Label><Input name="regionCode" defaultValue={territory.region_code ?? ""} /></div><div className="space-y-2"><Label>Code département</Label><Input name="departmentCode" defaultValue={territory.department_code ?? ""} /></div><div className="space-y-2 sm:col-span-2"><Label>Codes postaux</Label><Input name="postalCodes" defaultValue={territory.postal_codes?.join(", ") ?? ""} /></div><Button disabled={pending} className="sm:col-span-2">Enregistrer</Button></form>;
}
