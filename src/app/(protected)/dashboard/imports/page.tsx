import { ImportForm } from "@/components/reference/import-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrandRole } from "@/lib/auth";
import { uiLabel } from "@/lib/ui-copy";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";

export default async function ImportsPage() {
  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const { data: batches, error } = await supabase.from("import_batches").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(20);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Imports CSV</h1><p className="text-muted-foreground">Prévisualisez, contrôlez puis confirmez un lot atomique.</p></div><Card><CardHeader><CardTitle>Nouvel import</CardTitle><CardDescription>Entêtes attendues en anglais technique, séparateur virgule ou point-virgule. La prévisualisation utilise uniquement les tables de staging.</CardDescription></CardHeader><CardContent><ImportForm /></CardContent></Card><Card><CardHeader><CardTitle>Derniers lots</CardTitle></CardHeader><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Impossible de charger les imports.</p> : !batches?.length ? <p className="p-8 text-center text-muted-foreground">Aucun import enregistré.</p> : <Table><TableHeader><TableRow><TableHead>Fichier</TableHead><TableHead>Type</TableHead><TableHead>Stratégie</TableHead><TableHead>Valides</TableHead><TableHead>Erreurs</TableHead><TableHead>Doublons</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{batches.map((batch) => <TableRow key={batch.id}><TableCell className="font-medium">{batch.file_name}</TableCell><TableCell>{uiLabel(batch.entity_type)}</TableCell><TableCell>{uiLabel(batch.strategy)}</TableCell><TableCell>{batch.valid_rows}</TableCell><TableCell>{batch.error_rows}</TableCell><TableCell>{batch.duplicate_rows}</TableCell><TableCell><Badge variant="secondary">{uiLabel(batch.status)}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card></div>;
}
