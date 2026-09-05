import Link from "next/link";
import { TerritoryForm } from "@/components/reference/simple-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrandRole } from "@/lib/auth";
import { uiLabel } from "@/lib/ui-copy";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";

export default async function TerritoriesPage() {
  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const [{ data: territories, error }, { data: brandRecord }] = await Promise.all([supabase.from("territories").select("*").eq("brand_id", brand.id).is("archived_at", null).order("name"), supabase.from("brands").select("organization_id").eq("id", brand.id).single()]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Territoires</h1><p className="text-muted-foreground">Zones commerciales propres à {brand.name}.</p></div><div className="grid gap-6 xl:grid-cols-[1fr_420px]"><Card><CardHeader><CardTitle>Territoires actifs</CardTitle></CardHeader><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Impossible de charger les territoires.</p> : !territories?.length ? <p className="p-8 text-center text-muted-foreground">Aucun territoire configuré.</p> : <Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Type</TableHead><TableHead>Région</TableHead><TableHead>Département</TableHead><TableHead>Codes postaux</TableHead></TableRow></TableHeader><TableBody>{territories.map((territory) => <TableRow key={territory.id}><TableCell className="font-medium"><Link href={`/dashboard/territories/${territory.id}`} className="hover:underline">{territory.name}</Link></TableCell><TableCell>{uiLabel(territory.territory_type)}</TableCell><TableCell>{territory.region_code || "—"}</TableCell><TableCell>{territory.department_code || "—"}</TableCell><TableCell>{territory.postal_codes?.join(", ") || "—"}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card><CardHeader><CardTitle>Nouveau territoire</CardTitle></CardHeader><CardContent>{brandRecord ? <TerritoryForm organizationId={brandRecord.organization_id} /> : <p className="text-destructive">Organisation introuvable.</p>}</CardContent></Card></div></div>;
}
