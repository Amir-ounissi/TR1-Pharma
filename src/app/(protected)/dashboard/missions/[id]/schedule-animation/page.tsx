import { redirect } from "next/navigation";
import { OwnAnimationScheduleForm } from "@/components/missions/own-animation-schedule-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";

export default async function ScheduleAnimationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, brand, userId } = await requireActiveBrand();

  const { data: mission } = await supabase
    .from("missions")
    .select("id,title,objective,status,mission_type,assigned_user_id,scheduled_start_at,scheduled_end_at,pharmacies(legal_name,trade_name,city)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .eq("assigned_user_id", userId)
    .maybeSingle();

  if (!mission) redirect("/dashboard/field");
  if (mission.mission_type !== "animation" || mission.status !== "accepted") {
    redirect(`/dashboard/missions/${id}`);
  }

  const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Badge variant="secondary">Animation acceptée</Badge>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--tr1-navy)]">Planifier mon animation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}{pharmacy?.city ? ` · ${pharmacy.city}` : ""}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{mission.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{mission.objective}</p>
        </CardHeader>
        <CardContent>
          <OwnAnimationScheduleForm missionId={id} defaultStart={mission.scheduled_start_at} defaultEnd={mission.scheduled_end_at} />
        </CardContent>
      </Card>
    </div>
  );
}
