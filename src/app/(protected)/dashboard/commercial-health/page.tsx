import { AlertTriangle, Clock3, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { CommercialEventTracker } from "@/components/commercial/commercial-event-tracker";
import { CommercialSettingsForm } from "@/components/commercial/commercial-settings-form";
import { ReorderFollowupForm } from "@/components/commercial/reorder-followup-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{ filter?: string }>;

const filters = [
  ["", "Toutes"],
  ["first_reorder", "Premier réassort"],
  ["reorder_overdue", "Réassort en retard"],
  ["at_risk", "À risque"],
  ["dormant", "Dormant"],
  ["strategic", "Stratégique"],
  ["without_action", "Sans action"],
  ["high_potential", "Fort potentiel"],
];

function currency(value: number | string | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function delayLabel(value: number | null) {
  if (value === null) return "Non estimé";
  if (value > 0) return `${value} jour${value > 1 ? "s" : ""} de retard`;
  if (value === 0) return "Attendu aujourd’hui";
  return `Dans ${Math.abs(value)} jours`;
}

export default async function CommercialHealthPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const activeFilter = filters.some(([value]) => value === query.filter) ? query.filter ?? "" : "";
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: priorities }, { data: settings }, { data: contexts }] = await Promise.all([
    supabase.rpc("get_commercial_priorities", {
      target_brand_id: brand.id,
      target_filter: activeFilter || null,
      result_limit: 100,
    }),
    supabase.from("brand_settings").select("*").eq("brand_id", brand.id).maybeSingle(),
    supabase.rpc("get_my_brand_contexts"),
  ]);
  const rows = (priorities ?? []) as CommercialHealthRow[];
  const role = contexts?.find((context: { brand_id: string }) => context.brand_id === brand.id)?.role_key;
  const canManageSettings = role === "tr1_manager" || role === "brand_admin" || role === "super_admin";
  const firstReorders = rows.filter((row) => row.orders_count === 1).slice(0, 5);

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <CommercialEventTracker eventName="commercial_priority_opened" />
      <header className="rounded-3xl bg-[#0f2740] px-6 py-7 text-[#fffaf0]">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#7fb8df]">Console de décision · {brand.name}</p>
        <h1 className="mt-2 text-3xl font-semibold">Priorités commerciales</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#d7e2eb]">Les comptes à traiter maintenant, classés par urgence et accompagnés d’une recommandation explicable.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map(([value, label]) => (
          <Button key={value || "all"} asChild size="sm" variant={activeFilter === value ? "default" : "outline"}>
            <Link href={value ? `?filter=${value}` : "/dashboard/commercial-health"}>{label}</Link>
          </Button>
        ))}
      </div>

      {firstReorders.length ? (
        <section aria-labelledby="first-reorder-title" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#ee6c3b]" />
            <h2 id="first-reorder-title" className="text-xl font-semibold">Implantations à convertir</h2>
            <Badge variant="secondary">{firstReorders.length}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {firstReorders.map((row) => (
              <Card key={row.brand_pharmacy_id} className="border-[#f1c7a9] bg-[#fffaf0]">
                <CardHeader className="pb-3"><CardTitle className="text-base">{row.pharmacy_name}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>Implantée le <strong>{date(row.first_order_at)}</strong></p>
                  <p>Cible : <strong>{date(row.expected_reorder_at)}</strong></p>
                  <p className="font-semibold text-[#b64b25]">{delayLabel(row.expected_reorder_delay_days)}</p>
                  <Button asChild variant="outline" className="w-full"><Link href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`}>Ouvrir le compte</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-label="Liste prioritaire">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">À traiter</h2>
          <p className="text-sm text-muted-foreground">{rows.length} compte(s)</p>
        </div>
        {rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Aucun compte ne correspond à ce filtre.</CardContent></Card>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border bg-background md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Pharmacie</th><th className="p-3">Statut</th><th className="p-3">Dernière commande</th>
                    <th className="p-3">CA 90 j</th><th className="p-3">Tendance</th><th className="p-3">Priorité</th><th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.brand_pharmacy_id} className="border-t align-top hover:bg-muted/20" data-testid="commercial-priority-row">
                      <td className="p-3"><Link href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`} className="font-semibold hover:underline">{row.pharmacy_name}</Link><p className="text-xs text-muted-foreground">{row.territory_name || row.city} · {row.agent_name || "Non affectée"}</p></td>
                      <td className="p-3"><Badge variant={row.health_status === "dormant" || row.health_status === "at_risk" ? "destructive" : "secondary"}>{presentationLabel(row.health_status)}</Badge><p className="mt-1 text-xs">{delayLabel(row.expected_reorder_delay_days)}</p></td>
                      <td className="p-3">{date(row.last_order_at)}</td>
                      <td className="p-3">{currency(row.revenue_last_90d)}</td>
                      <td className="p-3">{presentationLabel(row.revenue_trend)}{row.revenue_trend_percent !== null ? ` · ${row.revenue_trend_percent}%` : ""}</td>
                      <td className="p-3"><strong>{row.priority_score}/100</strong><ul className="mt-1 space-y-1 text-xs text-muted-foreground">{row.priority_reasons.slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}</ul></td>
                      <td className="min-w-56 p-3"><p className="mb-2 font-medium">{row.recommendation}</p><ReorderFollowupForm brandPharmacyId={row.brand_pharmacy_id} recommendation={row.recommendation} compact /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {rows.map((row) => (
                <Card key={row.brand_pharmacy_id} data-testid="commercial-priority-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{row.pharmacy_name}</CardTitle><p className="text-xs text-muted-foreground">{row.city}</p></div><span className="rounded-full bg-[#0f2740] px-3 py-1 text-sm font-bold text-white">{row.priority_score}</span></div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2"><Badge variant="secondary">{presentationLabel(row.health_status)}</Badge><span>{delayLabel(row.expected_reorder_delay_days)}</span></div>
                    <p className="font-semibold">{row.recommendation}</p>
                    <ul className="space-y-1 text-muted-foreground">{row.priority_reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}</ul>
                    <div className="grid grid-cols-2 gap-2"><Button asChild variant="outline"><Link href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`}>Voir la fiche</Link></Button><span className="grid place-items-center rounded-md bg-muted text-xs">{currency(row.revenue_last_90d)} · 90 j</span></div>
                    <ReorderFollowupForm brandPharmacyId={row.brand_pharmacy_id} recommendation={row.recommendation} compact />
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {canManageSettings && settings ? (
        <details className="rounded-2xl border bg-background p-5">
          <summary className="cursor-pointer font-semibold">Configurer les règles de réassort</summary>
          <div className="mt-5"><CommercialSettingsForm settings={settings as Record<string, number>} /></div>
        </details>
      ) : null}

      <aside className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 pt-5"><Clock3 className="text-[#2d6f9f]" /><p className="text-sm">Cadence calculée par médiane dès trois intervalles.</p></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-5"><ShieldAlert className="text-[#ee6c3b]" /><p className="text-sm">Commandes non finalisées exclues des calculs.</p></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-5"><AlertTriangle className="text-[#b83a22]" /><p className="text-sm">Aucune tâche créée sans confirmation.</p></CardContent></Card>
      </aside>
    </main>
  );
}
