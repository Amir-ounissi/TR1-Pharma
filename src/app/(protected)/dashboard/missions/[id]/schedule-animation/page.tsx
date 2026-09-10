import { redirect } from "next/navigation";
import { OwnAnimationScheduleForm } from "@/components/missions/own-animation-schedule-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";

type MonthlyProgress = {
  month_start: string;
  expected_days: number;
  planned_days: number;
  realized_days: number;
  remaining_to_plan: number;
  planning_status: string;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

function monthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export default async function ScheduleAnimationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, brand, userId } = await requireActiveBrand();

  const { data: mission } = await supabase
    .from("missions")
    .select("id,title,objective,status,mission_type,assigned_user_id,scheduled_start_at,scheduled_end_at,animation_parent_request_id,animation_days_per_month,animation_start_month,animation_end_month,animation_remuneration_model,pharmacies(legal_name,trade_name,city)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .eq("assigned_user_id", userId)
    .maybeSingle();

  if (!mission) redirect("/dashboard/field");
  if (mission.mission_type !== "animation" || mission.status !== "accepted") {
    redirect(`/dashboard/missions/${id}`);
  }

  const requestMode = mission.animation_days_per_month !== null && mission.animation_parent_request_id === null;
  const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;

  let progress: MonthlyProgress[] = [];
  if (requestMode) {
    const today = new Date();
    const requestStart = mission.animation_start_month ? new Date(`${mission.animation_start_month}T00:00:00`) : today;
    const rangeStart = requestStart > today ? requestStart : new Date(today.getFullYear(), today.getMonth(), 1);
    let rangeEnd = addMonths(rangeStart, 2);
    if (mission.animation_end_month) {
      const requestEnd = new Date(`${mission.animation_end_month}T00:00:00`);
      if (requestEnd < rangeEnd) rangeEnd = requestEnd;
    }

    const callRpc = supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => RpcResult<MonthlyProgress[]>;
    const result = await callRpc("get_animation_request_monthly_progress", {
      target_request_mission_id: id,
      target_from_month: monthInputValue(rangeStart),
      target_to_month: monthInputValue(rangeEnd),
    });
    if (result.error) throw new Error(result.error.message);
    progress = result.data ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Badge variant="secondary">{requestMode ? "Demande acceptée" : "Animation acceptée"}</Badge>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--tr1-navy)]">
          {requestMode ? "Planifier les journées d’animation" : "Planifier mon animation"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}{pharmacy?.city ? ` · ${pharmacy.city}` : ""}
        </p>
      </div>

      {requestMode ? (
        <Card>
          <CardHeader>
            <CardTitle>Suivi de la demande</CardTitle>
            <p className="text-sm text-muted-foreground">
              {mission.animation_days_per_month} journée{mission.animation_days_per_month > 1 ? "s" : ""} d’animation par mois
              {mission.animation_start_month ? ` à partir de ${new Date(`${mission.animation_start_month}T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}` : ""}.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {progress.map((month) => (
              <div key={month.month_start} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="capitalize">
                    {new Date(`${month.month_start}T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </strong>
                  <Badge variant={month.remaining_to_plan === 0 ? "secondary" : "outline"}>
                    {month.remaining_to_plan === 0 ? "Planification complète" : `${month.remaining_to_plan} à positionner`}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <span><strong>{month.expected_days}</strong><span className="block text-xs text-muted-foreground">prévues</span></span>
                  <span><strong>{month.planned_days}</strong><span className="block text-xs text-muted-foreground">planifiées</span></span>
                  <span><strong>{month.realized_days}</strong><span className="block text-xs text-muted-foreground">réalisées</span></span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{requestMode ? "Ajouter une journée" : mission.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{mission.objective}</p>
        </CardHeader>
        <CardContent>
          <OwnAnimationScheduleForm
            missionId={id}
            defaultStart={requestMode ? null : mission.scheduled_start_at}
            defaultEnd={requestMode ? null : mission.scheduled_end_at}
            requestMode={requestMode}
          />
        </CardContent>
      </Card>
    </div>
  );
}
