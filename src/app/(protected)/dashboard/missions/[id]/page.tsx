import { notFound } from "next/navigation";
import { ProductEventTracker } from "@/components/agent/product-event-tracker";
import { MissionImpact, type ImpactRow } from "@/components/missions/mission-impact";
import { MissionImpactTracker } from "@/components/missions/mission-impact-tracker";
import { MissionReportForm, MissionStatusForm } from "@/components/missions/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requireActiveBrand } from "@/lib/auth";
import { uploadMissionAttachmentAction } from "../actions";

const transitions: Record<string, string[]> = {
  draft: ["requested", "cancelled"], requested: ["to_assign", "cancelled"],
  to_assign: ["assigned", "cancelled"], assigned: ["accepted", "rejected", "cancelled"],
  accepted: ["scheduled", "cancelled"], scheduled: ["in_progress", "no_show", "cancelled"],
  in_progress: ["report_pending", "cancelled"], report_pending: ["completed", "cancelled"],
};

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: mission }, { data: report }, { data: products }, { data: history }, { data: attachments }, { data: impactRows }] = await Promise.all([
    supabase.from("missions").select("*").eq("id", id).eq("brand_id", brand.id).maybeSingle(),
    supabase.from("mission_reports").select("*").eq("mission_id", id).maybeSingle(),
    supabase.from("mission_products").select("id,objective_type,target_quantity,products(name,sku)").eq("mission_id", id),
    supabase.from("mission_status_history").select("*").eq("mission_id", id).order("changed_at", { ascending: false }),
    supabase.from("mission_attachments").select("*").eq("mission_id", id).is("archived_at", null),
    supabase.rpc("get_mission_impact", { target_mission_id: id }),
  ]);
  if (!mission) notFound();

  return (
    <div className="space-y-6">
      <ProductEventTracker pharmacyId={mission.pharmacy_id} />
      {impactRows?.[0] ? <MissionImpactTracker eventName="mission_impact_viewed" missionId={id} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex gap-2"><Badge>{mission.mission_type}</Badge><Badge variant="secondary">{mission.status}</Badge></div>
          <h1 className="mt-2 text-2xl font-semibold">{mission.title}</h1>
          <p className="text-muted-foreground">{mission.objective}</p>
        </div>
        <p className="text-right text-sm">{mission.scheduled_start_at ? new Date(mission.scheduled_start_at).toLocaleString("fr-FR") : "À planifier"}<br /><strong>{Number(mission.cost_actual_ht).toLocaleString("fr-FR")} € HT</strong></p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Briefing</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap">{mission.briefing || "Aucun briefing."}</p><div className="mt-4 flex flex-wrap gap-2">{(products ?? []).map((item) => { const product = Array.isArray(item.products) ? item.products[0] : item.products; return <Badge variant="outline" key={item.id}>{product?.name || "Produit"}</Badge>; })}</div></CardContent></Card>
          <Card><CardHeader><CardTitle>Compte rendu</CardTitle></CardHeader><CardContent><MissionReportForm missionId={id} missionType={mission.mission_type} pharmacyId={mission.pharmacy_id} report={report} /></CardContent></Card>
          {impactRows?.[0] ? <MissionImpact impact={impactRows[0] as ImpactRow} /> : null}
          <Card><CardHeader><CardTitle>Pièces privées</CardTitle></CardHeader><CardContent>
            <form action={uploadMissionAttachmentAction} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"><input type="hidden" name="missionId" value={id} /><Input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /><Select name="visibility" defaultValue="shared"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shared">Partagé</SelectItem><SelectItem value="tr1_internal">TR1 interne</SelectItem><SelectItem value="provider_private">Intervenant</SelectItem></SelectContent></Select><Button>Ajouter</Button></form>
            <div className="mt-4 space-y-2">{(attachments ?? []).map((file) => <div className="flex justify-between rounded border p-2 text-sm" key={file.id}><span>{file.original_name}</span><Badge variant="outline">{file.visibility}</Badge></div>)}</div>
          </CardContent></Card>
        </div>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Workflow</CardTitle></CardHeader><CardContent><MissionStatusForm missionId={id} options={transitions[mission.status] ?? []} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Historique</CardTitle></CardHeader><CardContent className="space-y-3">{(history ?? []).map((entry) => <div key={entry.id} className="border-l-2 pl-3 text-sm"><strong>{entry.new_status}</strong><p className="text-muted-foreground">{new Date(entry.changed_at).toLocaleString("fr-FR")} · {entry.source}</p></div>)}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
