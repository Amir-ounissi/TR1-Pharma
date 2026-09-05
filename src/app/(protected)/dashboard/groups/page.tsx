import Link from "next/link";
import { GroupForm } from "@/components/reference/simple-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrandRole } from "@/lib/auth";
import { uiLabel } from "@/lib/ui-copy";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";

export default async function GroupsPage() {
  const { supabase } = await requireActiveBrandRole(referenceAdministrationRoles);
  const { data: groups, error } = await supabase.from("pharmacy_groups").select("*").is("archived_at", null).order("name");
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Groupements</h1><p className="text-muted-foreground">Référentiel physique commun aux marques autorisées.</p></div><div className="grid gap-6 xl:grid-cols-[1fr_420px]"><Card><CardHeader><CardTitle>Groupements actifs</CardTitle></CardHeader><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Impossible de charger les groupements.</p> : !groups?.length ? <p className="p-8 text-center text-muted-foreground">Aucun groupement associé aux pharmacies accessibles.</p> : <Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Type</TableHead><TableHead>Siège</TableHead><TableHead>Site</TableHead></TableRow></TableHeader><TableBody>{groups.map((group) => <TableRow key={group.id}><TableCell className="font-medium"><Link href={`/dashboard/groups/${group.id}`} className="hover:underline">{group.name}</Link></TableCell><TableCell>{uiLabel(group.group_type)}</TableCell><TableCell>{group.headquarters_city || "—"}</TableCell><TableCell>{group.website || "—"}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card><CardHeader><CardTitle>Nouveau groupement</CardTitle></CardHeader><CardContent><GroupForm /></CardContent></Card></div></div>;
}
