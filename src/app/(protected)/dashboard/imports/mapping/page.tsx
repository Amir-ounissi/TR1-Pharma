import Link from "next/link";
import { ArrowLeft, DatabaseZap, Save, Trash2 } from "lucide-react";
import { archiveMappingProfileAction, saveMappingProfileAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveBrandRole } from "@/lib/auth";
import { canonicalImportFields } from "@/lib/data-mapping";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";
import type { ImportEntity } from "@/lib/reference-data";

const entities: Array<{ key: ImportEntity; label: string }> = [
  { key: "pharmacies", label: "Pharmacies" },
  { key: "contacts", label: "Contacts" },
  { key: "brand_pharmacies", label: "Relations marque-pharmacie" },
  { key: "products", label: "Produits" },
  { key: "orders", label: "Commandes" },
];

function MappingGuide() {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {entities.map((entity) => (
        <Card key={entity.key} className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{entity.label}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {canonicalImportFields[entity.key].map((field) => (
              <Badge key={field.key} variant={field.required ? "default" : "secondary"} className="font-mono text-[10px]">
                {field.key}{field.required ? " *" : ""}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function DataMappingStudioPage() {
  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const { data: profiles, error } = await supabase
    .from("data_mapping_profiles")
    .select("id,name,entity_type,source_system,mapping,is_default,version,updated_at")
    .eq("brand_id", brand.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/dashboard/imports"><ArrowLeft className="size-4" />Imports</Link>
          </Button>
          <div className="flex items-center gap-2">
            <DatabaseZap className="size-6" />
            <h1 className="text-2xl font-semibold tracking-tight">Data Mapping Studio</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Adaptez les colonnes de chaque source au modèle canonique TR1 sans modifier les fichiers clients.
          </p>
        </div>
        <Badge variant="outline">{brand.name}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Profils enregistrés</CardTitle>
            <CardDescription>
              Un profil peut être réutilisé pour les exports récurrents d’un CRM, ERP ou logiciel métier.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <p className="p-6 text-destructive">Impossible de charger les profils de mapping.</p>
            ) : !profiles?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                Aucun profil pour cette marque. Créez le premier mapping ci-contre.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profil</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Champs</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const mapping = profile.mapping && typeof profile.mapping === "object" && !Array.isArray(profile.mapping)
                      ? (profile.mapping as Record<string, string>)
                      : {};
                    return (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <div className="font-medium">{profile.name}</div>
                          {profile.is_default ? <Badge className="mt-1" variant="secondary">Par défaut</Badge> : null}
                        </TableCell>
                        <TableCell>{entities.find((entity) => entity.key === profile.entity_type)?.label ?? profile.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs">{profile.source_system}</TableCell>
                        <TableCell>{Object.keys(mapping).length}</TableCell>
                        <TableCell>v{profile.version}</TableCell>
                        <TableCell>
                          <form action={archiveMappingProfileAction}>
                            <input type="hidden" name="id" value={profile.id} />
                            <Button type="submit" size="icon" variant="ghost" aria-label={`Archiver ${profile.name}`}>
                              <Trash2 className="size-4" />
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau profil</CardTitle>
            <CardDescription>
              Le JSON associe chaque entête source au champ canonique TR1. Utilisez <code>__ignore__</code> pour ignorer une colonne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveMappingProfileAction.bind(null, {})} className="space-y-4">
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
                  {entities.map((entity) => <option key={entity.key} value={entity.key}>{entity.label}</option>)}
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
              <Button type="submit" className="w-full"><Save className="size-4" />Enregistrer le profil</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Référentiel canonique TR1</h2>
          <p className="text-sm text-muted-foreground">Les champs marqués * sont obligatoires pour valider un mapping.</p>
        </div>
        <MappingGuide />
      </div>
    </div>
  );
}
