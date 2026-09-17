import { Target } from "lucide-react";
import { AgentMonthlyTargetForm } from "@/components/agent/agent-monthly-target-form";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { parisBusinessDate } from "@/lib/business-date";

type ObjectiveProgressRow = {
  metric_key: string;
  target_value: number;
  realized_value: number;
};

function currency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function AgentSettingsPage() {
  const [session, contexts] = await Promise.all([
    requireActiveBrand(),
    getBrandContexts(),
  ]);
  const { supabase, brand, userId } = session;
  const canConfigureAgentSettings = contexts.some(
    (context) => context.id === brand.id && context.role === "agent",
  );

  if (!canConfigureAgentSettings) {
    throw new Error("Les paramètres Agent ne sont pas disponibles pour ce rôle.");
  }

  const today = parisBusinessDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [objectiveResult, personalTargetResult] = await Promise.all([
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: monthStart,
      target_filter_end: today,
      target_scope_type: "agent",
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase
      .from("agent_personal_monthly_targets")
      .select("revenue_target_ht")
      .eq("brand_id", brand.id)
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .maybeSingle(),
  ]);

  if (objectiveResult.error) throw new Error(objectiveResult.error.message);
  if (personalTargetResult.error) throw new Error(personalTargetResult.error.message);

  const revenueObjective = ((objectiveResult.data ?? []) as ObjectiveProgressRow[]).find(
    (objective) => objective.metric_key === "revenue_ht",
  );
  const personalTarget = personalTargetResult.data?.revenue_target_ht == null
    ? null
    : Number(personalTargetResult.data.revenue_target_ht);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date());

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 pb-8">
      <header>
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
          Paramètres Agent
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--tr1-navy)]">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les réglages de ton espace terrain sont regroupés ici.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="monthly-target-settings">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[var(--tr1-orange)]">
            <Target className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="monthly-target-settings" className="text-lg font-semibold text-[var(--tr1-navy)]">
              Objectif mensuel
            </h2>
            <p className="text-sm text-muted-foreground">
              {brand.name} · {monthLabel}
            </p>
          </div>
        </div>

        {revenueObjective ? (
          <div className="rounded-xl border border-[var(--tr1-line)] bg-white p-5">
            <p className="text-sm font-semibold text-[var(--tr1-navy)]">Objectif attribué par la marque</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--tr1-navy)]">
              {currency(Number(revenueObjective.target_value))}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cet objectif est officiel et ne peut pas être remplacé par un objectif personnel.
            </p>
          </div>
        ) : (
          <AgentMonthlyTargetForm
            brandId={brand.id}
            monthStart={monthStart}
            currentTarget={personalTarget}
          />
        )}
      </section>
    </main>
  );
}
