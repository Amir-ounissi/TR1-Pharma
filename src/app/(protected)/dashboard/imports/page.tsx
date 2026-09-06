import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { ImportForm } from "@/components/reference/import-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrandRole } from "@/lib/auth";
import { uiLabel } from "@/lib/ui-copy";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";
import type { ImportEntity } from "@/lib/reference-data";

export default async function ImportsPage() {
  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const [{ data: batches, error }, { data: mappingCapability }] = await Promise.all([
    supabase.from("import_batches").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("has_brand_capability", { target_brand_id: brand.id, target_capability_key: "data_mapping" }),
  ]);

  const { data: profiles } = mappingCapability
    ? await supabase
        .from("data_mapping_profiles")
        .select("id,name,entity_type,source_system,is_default,version")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name")
    : { data: [] };

  const mappingProfiles = (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    entityType: profile.entity_type as ImportEntity,
    sourceSystem: profile.source_system,
    isDefault: profile.is_default,
    version: profile.version,
  }));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">Imports CSV</h1><p className="text-muted-foreground">Prévisualisez, contrôlez puis confirmez un lot atomique.</p></div>
      {mappingCapability ? <Button asChild variant="outline"><Link href="/dashboard/imports/mapping"><DatabaseZap className="size-4" />Data Mapping Studio</Link></Button> : null}
    </div>
    <Card><CardHeader><CardTitle>Nouvel import</CardTitle><CardDescription>La détection automatique TR1 reste disponible. Avec Data Mapping Studio, un format CRM/ERP récurrent peut être normalisé sans modifier le fichier source.</CardDescription></CardHeader><CardContent><ImportForm mappingProfiles={mappingProfiles} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Derniers lots</CardTitle></CardHeader><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Impossible de charger les imports.</p> : !batches?.length ? <p className="p-8 text-center text-muted-foreground">Aucun import enregistré.</p> : <Table><TableHeader><TableRow><TableHead>Fichier</TableHead><TableHead>Type</TableHead><TableHead>Stratégie</TableHead><TableHead>Valides</TableHead><TableHead>Erreurs</TableHead><TableHead>Doublons</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{batches.map((batch) => <TableRow key={batch.id}><TableCell className="font-medium">{batch.file_name}</TableCell><TableCell>{uiLabel(batch.entity_type)}</TableCell><TableCell>{uiLabel(batch.strategy)}</TableCell><TableCell>{batch.valid_rows}</TableCell><TableCell>{batch.error_rows}</TableCell><TableCell>{batch.duplicate_rows}</TableCell><TableCell><Badge variant="secondary">{uiLabel(batch.status)}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
  </div>;
}
