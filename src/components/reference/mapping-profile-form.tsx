"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { saveMappingProfileAction } from "@/app/(protected)/dashboard/imports/mapping/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MappingProfileForm() {
  const [state, action, pending] = useActionState(saveMappingProfileAction, {});

  return (
    <form action={action} className="space-y-4">
      <ActionFeedback error={state.error} success={state.success} />
      <div className="space-y-2">
        <Label htmlFor="name">Nom du profil</Label>
        <Input id="name" name="name" placeholder="Export HubSpot pharmacies" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sourceSystem">Système source</Label>
        <Input id="sourceSystem" name="sourceSystem" defaultValue="generic_csv" placeholder="hubspot" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="entityType">Type de données</Label>
        <select id="entityType" name="entityType" defaultValue="pharmacies" className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
          <option value="pharmacies">Pharmacies</option>
          <option value="contacts">Contacts</option>
          <option value="brand_pharmacies">Relations marque-pharmacie</option>
          <option value="products">Produits</option>
          <option value="orders">Commandes</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mappingJson">Mapping source → TR1</Label>
        <Textarea
          id="mappingJson"
          name="mappingJson"
          rows={10}
          className="font-mono text-xs"
          defaultValue={'{\n  "Nom officine": "legal_name",\n  "Code postal": "postal_code",\n  "Ville": "city",\n  "Commentaire": "__ignore__"\n}'}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" />
        Utiliser ce profil par défaut pour ce type de données
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        <Save className="size-4" />{pending ? "Enregistrement…" : "Enregistrer le profil"}
      </Button>
    </form>
  );
}
