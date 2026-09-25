import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Megaphone,
  PackageCheck,
  ShoppingCart,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import type { NextBestActionRow } from "@/lib/next-best-action";
import { getPharmacyCockpit } from "@/lib/pharmacy-cockpit";
import { presentationText } from "@/lib/presentation";
import { formatCurrency } from "@/lib/reference-data";
import { buildVisitBrief, type VisitBriefFact, type VisitBriefSignal } from "@/lib/visit-brief";

type RelationRow = {
  id: string;
  pharmacy_id: string;
  last_interaction_at: string | null;
  last_order_at: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  commercial_status: string | null;
  pharmacies:
    | { trade_name: string | null; legal_name: string | null; city: string | null }
    | Array<{ trade_name: string | null; legal_name: string | null; city: string | null }>
    | null;
};

type OrderRow = {
  id: string;
  order_date: string;
  net_amount_ht: number | string | null;
  order_status: string;
  is_initial_order: boolean | null;
  is_reorder: boolean | null;
};

type PerformanceRow = {
  first_valid_order_at?: string | null;
  last_valid_order_at?: string | null;
  valid_order_count?: number | null;
  reorder_count?: number | null;
  average_days_between_orders?: number | string | null;
};

type DistributionRow = {
  strategic_distribution_rate?: number | string | null;
  missing_products?: unknown;
};

type TaskRow = {
  id: string;
  title: string;
  effective_status: string;
  due_at: string | null;
};

type MissionImpactRow = {
  mission_id: string;
  mission_title: string;
  mission_date: string;
  mission_type: string;
  sell_out_units: number | null;
  observation_maturity: string | null;
};

type SellOutCaptureRow = {
  id: string;
  quality: "confirmed" | "declared" | "estimated" | "imported" | null;
  status: string;
  period_start: string;
  period_end: string;
  observed_at: string;
  source_label: string | null;
};

type SellOutLineRow = {
  units_sold: number | null;
  theoretical_units: number | null;
  stock_current: number | null;
  label: string | null;
};

type FieldVisitRow = {
  id: string;
  title: string;
  objective: string | null;
  notes: string | null;
  outcome: string | null;
  status: string;
  scheduled_start_at: string;
  actual_end_at: string | null;
  completed_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatDays(value?: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed)} j` : null;
}

function missingProductLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = row.name ?? row.product_name ?? row.label ?? row.sku;
    return typeof label === "string" && label.trim() ? [label.trim()] : [];
  });
}

function qualityLabel(value: SellOutCaptureRow["quality"]) {
  if (value === "confirmed") return "Confirmé";
  if (value === "declared") return "Déclaré";
  if (value === "estimated") return "Estimé";
  if (value === "imported") return "Importé";
  return "À confirmer";
}

function visitSummary(visit: FieldVisitRow | null) {
  if (!visit) return null;
  return visit.notes?.trim() || visit.objective?.trim() || null;
}

function SignalList({ items, empty }: { items: VisitBriefSignal[]; empty: string }) {
  if (!items.length) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <p>{empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="font-semibold text-[var(--tr1-navy)]">{item.title}</p>
          {item.detail ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p> : null}
          {item.source ? <p className="mt-2 text-xs font-medium text-muted-foreground">Source : {item.source}</p> : null}
        </div>
      ))}
    </div>
  );
}

export default async function VisitBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();

  const { data: relationData, error: relationError } = await supabase
    .from("brand_pharmacies")
    .select("id,pharmacy_id,last_interaction_at,last_order_at,next_action_type,next_action_at,commercial_status,pharmacies(trade_name,legal_name,city)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();

  if (relationError) throw relationError;
  if (!relationData) notFound();

  const relation = relationData as RelationRow;
  const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
  const pharmacyName = pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie";

  const [
    orderResult,
    performanceResult,
    distributionResult,
    tasksResult,
    healthResult,
    nextActionResult,
    missionImpactResult,
    sellOutCaptureResult,
    visitBrandResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_date,net_amount_ht,order_status,is_initial_order,is_reorder")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .is("archived_at", null)
      .in("order_status", ["confirmed", "invoiced", "partially_delivered", "delivered"])
      .order("order_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("brand_pharmacy_order_performance")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .maybeSingle(),
    supabase
      .from("brand_pharmacy_distribution")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .maybeSingle(),
    supabase
      .from("commercial_tasks")
      .select("id,title,effective_status,due_at")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .in("effective_status", ["open", "in_progress", "overdue"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase.rpc("get_commercial_health", { target_brand_pharmacy_id: id }),
    supabase.rpc("get_next_best_actions", {
      target_brand_id: brand.id,
      result_limit: 1,
      target_brand_pharmacy_id: id,
    }),
    supabase
      .from("mission_impact")
      .select("mission_id,mission_title,mission_date,mission_type,sell_out_units,observation_maturity")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .order("mission_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sell_out_captures")
      .select("id,quality,status,period_start,period_end,observed_at,source_label")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .in("status", ["validated", "review_required"])
      .is("archived_at", null)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("field_visit_brands")
      .select("visit_id")
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", id)
      .limit(20),
  ]);

  for (const result of [
    orderResult,
    performanceResult,
    distributionResult,
    tasksResult,
    healthResult,
    missionImpactResult,
    sellOutCaptureResult,
    visitBrandResult,
  ]) {
    if (result.error) throw result.error;
  }

  if (nextActionResult.error && nextActionResult.error.code !== "42501") {
    throw nextActionResult.error;
  }

  const order = (orderResult.data ?? null) as OrderRow | null;
  const performance = (performanceResult.data ?? null) as PerformanceRow | null;
  const distribution = (distributionResult.data ?? null) as DistributionRow | null;
  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const health = ((healthResult.data ?? [])[0] ?? null) as CommercialHealthRow | null;
  const nextBestAction = nextActionResult.error
    ? null
    : (((nextActionResult.data ?? [])[0] ?? null) as NextBestActionRow | null);
  const missionImpact = (missionImpactResult.data ?? null) as MissionImpactRow | null;
  const sellOutCapture = (sellOutCaptureResult.data ?? null) as SellOutCaptureRow | null;

  const visitIds = (visitBrandResult.data ?? []).map((row) => row.visit_id).filter(Boolean);
  const latestVisitResult = visitIds.length
    ? await supabase
        .from("field_visits")
        .select("id,title,objective,notes,outcome,status,scheduled_start_at,actual_end_at,completed_at")
        .in("id", visitIds)
        .is("archived_at", null)
        .order("scheduled_start_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };

  if (latestVisitResult.error) throw latestVisitResult.error;
  const latestVisit = (latestVisitResult.data ?? null) as FieldVisitRow | null;

  const sellOutLinesResult = sellOutCapture
    ? await supabase
        .from("sell_out_lines")
        .select("units_sold,theoretical_units,stock_current,label")
        .eq("brand_id", brand.id)
        .eq("brand_pharmacy_id", id)
        .eq("capture_id", sellOutCapture.id)
    : { data: [], error: null };

  if (sellOutLinesResult.error) throw sellOutLinesResult.error;
  const sellOutLines = (sellOutLinesResult.data ?? []) as SellOutLineRow[];

  const missingProducts = missingProductLabels(distribution?.missing_products);
  const overdueTasks = tasks.filter((task) => task.effective_status === "overdue").length;
  const sellOutUnits = sellOutLines.reduce(
    (sum, line) => sum + Number(line.units_sold ?? line.theoretical_units ?? 0),
    0,
  );
  const lowStockLines = sellOutLines.filter(
    (line) => line.stock_current != null && Number(line.stock_current) <= 2,
  );

  const cockpit = getPharmacyCockpit({
    firstOrderAt: performance?.first_valid_order_at,
    validOrderCount: performance?.valid_order_count,
    reorderCount: performance?.reorder_count,
    strategicDistributionRate:
      distribution?.strategic_distribution_rate == null
        ? null
        : Number(distribution.strategic_distribution_rate),
    missingProducts,
    healthStatus: health?.health_status,
    priorityReasons: health?.priority_reasons,
    hasNextAction: Boolean(relation.next_action_type || relation.next_action_at),
    commercialStatus: relation.commercial_status,
  });

  const facts: {
    lastInteraction?: VisitBriefFact | null;
    lastOrder?: VisitBriefFact | null;
    reorder?: VisitBriefFact | null;
    distribution?: VisitBriefFact | null;
  } = {
    lastInteraction: latestVisit
      ? {
          label: "Dernière visite",
          value: formatDate(
            latestVisit.completed_at || latestVisit.actual_end_at || latestVisit.scheduled_start_at,
          ),
          detail: visitSummary(latestVisit),
        }
      : relation.last_interaction_at
        ? { label: "Dernier échange", value: formatDate(relation.last_interaction_at) }
        : null,
    lastOrder: order
      ? {
          label: "Dernière commande",
          value: formatCurrency(order.net_amount_ht),
          detail: formatDate(order.order_date),
        }
      : null,
    reorder: performance?.valid_order_count
      ? {
          label: "Réassorts",
          value: `${Number(performance.reorder_count ?? 0)}`,
          detail: formatDays(performance.average_days_between_orders)
            ? `Cadence moyenne : ${formatDays(performance.average_days_between_orders)}`
            : `${Number(performance.valid_order_count)} commande(s) valide(s)`,
        }
      : null,
    distribution:
      distribution?.strategic_distribution_rate != null
        ? {
            label: "Distribution stratégique",
            value: `${Math.round(
              Number(distribution.strategic_distribution_rate) *
                (Number(distribution.strategic_distribution_rate) <= 1 ? 100 : 1),
            )} %`,
            detail: missingProducts.length
              ? `${missingProducts.length} référence(s) manquante(s)`
              : "Assortiment couvert",
          }
        : null,
  };

  const brief = buildVisitBrief({
    ...facts,
    overdueTasks,
    healthReasons: health?.priority_reasons,
    missingProducts,
    nextBestAction: nextBestAction
      ? {
          label: nextBestAction.action_label,
          rationale: nextBestAction.rationale,
          dueAt: formatDate(nextBestAction.suggested_due_at),
        }
      : null,
    recentMission: missionImpact
      ? {
          title: `Revenir sur ${missionImpact.mission_title}`,
          detail:
            missionImpact.sell_out_units != null
              ? `${missionImpact.sell_out_units} unité(s) sell-out observée(s) après cette action.`
              : "Une action terrain récente mérite un suivi pendant la visite.",
          source: `Mission du ${formatDate(missionImpact.mission_date)}`,
        }
      : null,
    sellOut: sellOutCapture
      ? {
          title: lowStockLines.length
            ? `${lowStockLines.length} référence(s) avec stock faible dans le dernier relevé`
            : "Dernier relevé sell-out disponible",
          detail:
            sellOutUnits > 0
              ? `${sellOutUnits} unité(s) observée(s) sur ${sellOutLines.length} ligne(s).`
              : `${sellOutLines.length} ligne(s) relevée(s).`,
          source: `${qualityLabel(sellOutCapture.quality)} · ${formatDate(sellOutCapture.observed_at)}${
            sellOutCapture.source_label ? ` · ${sellOutCapture.source_label}` : ""
          }`,
        }
      : null,
    fallbackObjective: cockpit.primaryAction.label,
  });

  const lastVisitSummary = visitSummary(latestVisit);

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-28 sm:pb-10">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/dashboard/pharmacies/${id}`} className="min-h-11 touch-manipulation">
          <ArrowLeft className="size-4" /> Retour à la pharmacie
        </Link>
      </Button>

      <header className="rounded-2xl bg-[var(--tr1-navy)] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-orange-300">
              Préparer ma visite · {brand.name}
            </p>
            <h1 className="mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl">{pharmacyName}</h1>
            <p className="mt-1 text-sm text-white/70">{pharmacy?.city || "Ville non renseignée"}</p>
          </div>
          <Badge className="bg-orange-300 text-[var(--tr1-navy)] hover:bg-orange-300">Brief terrain</Badge>
        </div>
        <div className="mt-6 rounded-xl border border-white/15 bg-white/10 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-orange-300">
            <Target className="size-4" /> Objectif conseillé
          </p>
          <p className="mt-2 text-xl font-semibold leading-snug">{brief.objective}</p>
          <p className="mt-2 text-xs text-white/60">
            Construit uniquement à partir des données disponibles dans TR1.
          </p>
        </div>
      </header>

      {brief.atAGlance.length ? (
        <section aria-labelledby="visit-brief-glance-title">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="size-5 text-[var(--tr1-orange)]" />
            <h2 id="visit-brief-glance-title" className="text-lg font-semibold">À retenir en 30 secondes</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {brief.atAGlance.map((fact) => (
              <Card key={fact.label}>
                <CardContent className="pt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{fact.label}</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--tr1-navy)]">{fact.value}</p>
                  {fact.detail ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{fact.detail}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {latestVisit && lastVisitSummary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-5 text-[var(--tr1-orange)]" /> Dernière préparation / note de visite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{lastVisitSummary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Visite du {formatDate(latestVisit.completed_at || latestVisit.actual_end_at || latestVisit.scheduled_start_at)}
              {latestVisit.outcome ? ` · Issue : ${latestVisit.outcome}` : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="visit-brief-alerts-title" className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-[#a74413]" />
            <h2 id="visit-brief-alerts-title" className="text-lg font-semibold">Alertes</h2>
          </div>
          <SignalList
            items={brief.alerts}
            empty="Aucune alerte suffisamment documentée dans les données disponibles."
          />
        </section>

        <section aria-labelledby="visit-brief-opportunities-title" className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-[var(--tr1-orange)]" />
            <h2 id="visit-brief-opportunities-title" className="text-lg font-semibold">Opportunités</h2>
          </div>
          <SignalList
            items={brief.opportunities}
            empty="Aucune opportunité spécifique n’est suffisamment documentée pour être affichée."
          />
        </section>
      </div>

      {tasks.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Actions ouvertes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tasks.slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{presentationText(task.title)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.due_at ? `Échéance : ${formatDate(task.due_at)}` : "Sans échéance"}
                  </p>
                </div>
                {task.effective_status === "overdue" ? (
                  <Badge variant="destructive">En retard</Badge>
                ) : (
                  <Badge variant="secondary">Ouverte</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <nav aria-label="Actions depuis le brief" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button asChild size="lg" className="min-h-14">
          <Link href={`/dashboard/orders/new?pharmacy=${id}`}><ShoppingCart className="size-5" /> Commander</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="min-h-14">
          <Link href="/dashboard/missions/new?mode=animation"><Megaphone className="size-5" /> Animation</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-14">
          <Link href={`/dashboard/pharmacies/${id}?tab=activity`}><ClipboardList className="size-5" /> Actions</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-14">
          <Link href={`/dashboard/pharmacies/${id}`}><PackageCheck className="size-5" /> Fiche pharmacie</Link>
        </Button>
      </nav>
    </main>
  );
}
