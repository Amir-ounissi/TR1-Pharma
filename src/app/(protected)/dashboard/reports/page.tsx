import { reviewReportAction } from "../missions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireActiveBrand } from "@/lib/auth";

export default async function ReportsPage() {
  const { supabase, brand } = await requireActiveBrand();
  const { data: reports } = await supabase.from("mission_reports").select("id,mission_id,report_status,summary,submitted_at,data_quality_status").eq("brand_id", brand.id).in("report_status", ["submitted", "needs_correction"]).order("submitted_at");
  const missionIds = (reports ?? []).map((report) => report.mission_id);
  const { data: missions } = missionIds.length
    ? await supabase.from("missions").select("id,title,mission_type").in("id", missionIds)
    : { data: [] };
  const missionById = new Map((missions ?? []).map((mission) => [mission.id, mission]));

  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Validation des rapports</h1><p className="text-muted-foreground">Contrôle qualité avant clôture de mission.</p></div>{(reports ?? []).map((report) => { const mission = missionById.get(report.mission_id); return <Card key={report.id} data-mission-id={report.mission_id}><CardHeader><div className="flex justify-between"><CardTitle>{mission?.title || "Mission"}</CardTitle><Badge>{report.report_status}</Badge></div></CardHeader><CardContent><p className="mb-4 whitespace-pre-wrap">{report.summary}</p><form action={reviewReportAction} className="flex flex-wrap gap-2"><input type="hidden" name="reportId" value={report.id}/><input type="hidden" name="missionId" value={report.mission_id}/><Input name="reason" placeholder="Motif de correction ou rejet" className="min-w-72 flex-1"/><Button name="status" value="validated">Valider</Button><Button name="status" value="needs_correction" variant="outline">À corriger</Button><Button name="status" value="rejected" variant="destructive">Rejeter</Button></form></CardContent></Card>; })}{!reports?.length && <p className="rounded-md border p-8 text-center text-muted-foreground">Aucun rapport en attente.</p>}</div>;
}
