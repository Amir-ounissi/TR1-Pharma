import Link from "next/link";
import { CalendarPlus, RotateCcw, Inbox } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompactPageHeader } from "@/components/ux/compact-page-header";
import { EmptyState } from "@/components/ux/empty-state";
import { InlineError } from "@/components/ux/inline-error";
import { Toolbar, ToolbarMeta, ToolbarRow } from "@/components/ux/toolbar";
import { getBrandContexts, getOptionalActiveBrand } from "@/lib/auth";
import { missionStatuses, missionTypes } from "@/lib/missions";
import { uiLabel } from "@/lib/ui-copy";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ q?:string; status?:string; type?:string }> }) {
  const filters = await searchParams;
  const [session, contexts] = await Promise.all([getOptionalActiveBrand(), getBrandContexts()]);
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  let role = "brand_user";
  let contextLabel = "Terrain";
  if (facilitatorOnly) {
    role = "facilitator";
    contextLabel = "Toutes mes marques";
  } else {
    if (!session.brand) redirect("/select-brand");
    role = contexts.find((context) => context.id === session.brand?.id)?.role ?? "brand_user";
    contextLabel = session.brand.name;
  }

  const canCreateMission = ["brand_admin", "tr1_manager", "super_admin"].includes(role);
  const canProposeMission = role === "facilitator";
  let query = session.supabase
    .from("missions")
    .select("id,title,mission_type,status,priority,scheduled_start_at,report_due_at,assigned_user_id,managed_by,users!missions_intervenor_user_id_fkey(user_profiles(full_name)),pharmacies(legal_name,trade_name,city),brands(name)")
    .is("archived_at", null)
    .order("scheduled_start_at", { ascending: false })
    .limit(100);

  if (facilitatorOnly) query = query.eq("assigned_user_id", session.userId);
  else query = query.eq("brand_id", session.brand!.id);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("mission_type", filters.type);

  const { data: missions, error } = await query;
  const hasActiveFilters = Boolean(filters.q || filters.status || filters.type);
  const createLabel = canCreateMission ? "Nouvelle mission" : "Planifier des animations";

  return <div className="space-y-3">
    <CompactPageHeader
      eyebrow={`Terrain / ${contextLabel}`}
      title={facilitatorOnly ? "Mes animations" : "Missions"}
      description={facilitatorOnly ? "Toutes vos animations, quelle que soit la marque, dans une seule liste." : "Le planning, les affectations et les statuts se suivent ici dans une lecture opérationnelle plus directe."}
      actions={canCreateMission ? <div className="flex gap-2"><Button asChild variant="outline" className="h-9"><Link href="/dashboard/missions/proposals"><Inbox className="size-4"/>Propositions à valider</Link></Button><Button asChild className="h-9 rounded-md bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]"><Link href="/dashboard/missions/new"><CalendarPlus className="size-4" />Nouvelle mission</Link></Button></div> : canProposeMission ? <Button asChild className="h-9 rounded-md bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]"><Link href="/dashboard/missions/new"><CalendarPlus className="size-4" />Planifier des animations</Link></Button> : undefined}
    />

    <Toolbar>
      <ToolbarRow className="justify-between">
        <ToolbarMeta>{missions?.length ?? 0} mission(s)</ToolbarMeta>
        {hasActiveFilters ? <Button asChild size="sm" variant="ghost" className="h-8 px-2.5 text-[var(--tr1-navy)]"><Link href="/dashboard/missions"><RotateCcw className="size-3.5" />Réinitialiser</Link></Button> : null}
      </ToolbarRow>
      <form className="mt-2 grid gap-2 sm:grid-cols-[1.9fr_0.9fr_1fr_auto]">
        <Input name="q" placeholder="Rechercher une mission" defaultValue={filters.q} className="h-9 rounded-md bg-white/90 text-sm" />
        <select name="status" defaultValue={filters.status ?? ""} className="h-9 rounded-md border bg-white/90 px-3 text-sm">
          <option value="">Tous les statuts</option>
          {missionStatuses.map((value) => <option key={value} value={value}>{uiLabel(value)}</option>)}
        </select>
        <select name="type" defaultValue={filters.type ?? ""} className="h-9 rounded-md border bg-white/90 px-3 text-sm">
          <option value="">Tous les types</option>
          {missionTypes.map((value) => <option key={value} value={value}>{uiLabel(value)}</option>)}
        </select>
        <Button type="submit" className="h-9 rounded-md bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]">Filtrer</Button>
      </form>
    </Toolbar>

    {error ? (
      <InlineError title="Impossible de charger les missions." description="Réessayez ou revenez aux filtres par défaut." action={<Button asChild size="sm" variant="outline"><Link href="/dashboard/missions">Réessayer</Link></Button>} />
    ) : (missions ?? []).length === 0 ? (
      <EmptyState
        tone={hasActiveFilters ? "no_results" : "no_data"}
        title={hasActiveFilters ? "Aucune mission ne correspond à ces filtres." : facilitatorOnly ? "Aucune animation planifiée pour le moment." : "Aucune mission planifiée pour le moment."}
        description={hasActiveFilters ? "Essayez d’élargir votre recherche ou de réinitialiser les filtres." : facilitatorOnly ? "Ajoutez une ou plusieurs animations sans ressaisir les informations communes." : "Créez une première mission pour commencer à piloter les interventions terrain."}
        action={hasActiveFilters ? <Button asChild size="sm" variant="outline"><Link href="/dashboard/missions"><RotateCcw className="size-3.5" />Réinitialiser</Link></Button> : canCreateMission || canProposeMission ? <Button asChild size="sm" className="h-9 bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]"><Link href="/dashboard/missions/new"><CalendarPlus className="size-3.5" />{createLabel}</Link></Button> : undefined}
      />
    ) : (
      <div className="overflow-hidden rounded-[0.8rem] border border-[var(--tr1-line)] bg-white/78">
        <Table className="text-[0.75rem]">
          <TableHeader className="bg-[var(--tr1-navy)] text-white">
            <TableRow className="border-white/10 hover:bg-[var(--tr1-navy)]">
              <TableHead className="h-10 px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Mission</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Pharmacie</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Type</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Statut</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Responsable</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(missions ?? []).map((mission) => {
              const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;
              const brand = Array.isArray(mission.brands) ? mission.brands[0] : mission.brands;
              const assignedUser = Array.isArray(mission.users) ? mission.users[0] : mission.users;
              const profile = Array.isArray(assignedUser?.user_profiles) ? assignedUser.user_profiles[0] : assignedUser?.user_profiles;
              const href = facilitatorOnly ? `/dashboard/field/missions/${mission.id}` : `/dashboard/missions/${mission.id}`;
              return <TableRow key={mission.id} className="border-[var(--tr1-line)] hover:bg-white/45">
                <TableCell className="px-3 py-2.5"><Link className="text-[0.82rem] font-semibold text-[var(--tr1-navy)] hover:text-[var(--tr1-orange)]" href={href}>{mission.title}</Link></TableCell>
                <TableCell className="px-3 py-2.5"><p className="font-medium text-[var(--tr1-navy)]">{pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}</p><p className="text-[0.68rem] text-muted-foreground">{pharmacy?.city || "Ville non renseignée"}{facilitatorOnly && brand?.name ? ` · ${brand.name}` : ""}</p></TableCell>
                <TableCell className="px-3 py-2.5 text-[0.72rem] text-[var(--tr1-navy)]">{uiLabel(mission.mission_type)}</TableCell>
                <TableCell className="px-3 py-2.5"><Badge variant={mission.status === "report_pending" ? "destructive" : "secondary"} className="h-5 rounded-full text-[0.54rem]">{uiLabel(mission.status)}</Badge></TableCell>
                <TableCell className="px-3 py-2.5 text-[0.72rem] text-[var(--tr1-navy)]">{profile?.full_name || "Non affectée"}</TableCell>
                <TableCell className="px-3 py-2.5 text-[0.72rem] text-[var(--tr1-navy)]">{mission.scheduled_start_at ? new Date(mission.scheduled_start_at).toLocaleString("fr-FR") : "À planifier"}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>
    )}
  </div>;
}
