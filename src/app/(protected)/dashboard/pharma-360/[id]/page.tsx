import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Boxes, Building2, CalendarDays, Megaphone, ShoppingCart, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent } from "@/lib/performance";
import { pharma360Address, pharma360SectionCoverage, type Pharma360Snapshot } from "@/lib/pharma-360";
import { presentationLabel } from "@/lib/presentation";

type Params = Promise<{ id: string }>;

function stringValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function confidenceLabel(value: string) {
  if (value === "high") return "Élevée";
  if (value === "medium") return "Moyenne";
  return "Prudente";
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export default async function Pharma360DetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();

  const { data, error } = await supabase.rpc("get_pharma_360", {
    target_brand_id: brand.id,
    target_brand_pharmacy_id: id,
  });
  if (error) {
    if (error.code === "P0002") notFound();
    throw error;
  }
  if (!data || typeof data !== "object") notFound();
  const snapshot = data as Pharma360Snapshot;
  const coverage = pharma360SectionCoverage(snapshot);
  const account = snapshot.account;
  const business = snapshot.business;
  const assortment = snapshot.assortment;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/pharma-360">← Portefeuille Pharma 360</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href={`/dashboard/pharmacies/${id}`}>Fiche opérationnelle</Link></Button>
      </div>

      <PageHeader
        eyebrow={`Pharma 360 · ${brand.name}`}
        title={account.pharmacy_name}
        description={`${pharma360Address(snapshot) || "Adresse non renseignée"}${account.group_name ? ` · ${account.group_name}` : ""}`}
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Synthèse Pharma 360">
        <Metric label="CA cumulé HT" value={formatCompactCurrency(Number(business.total_revenue_ht ?? 0))} icon={TrendingUp} />
        <Metric label="CA 90 jours" value={formatCompactCurrency(Number(business.revenue_last_90d_ht ?? 0))} icon={Activity} />
        <Metric label="Commandes" value={formatCompactNumber(Number(business.orders_count ?? 0))} icon={ShoppingCart} />
        <Metric label="Réassorts" value={formatCompactNumber(Number(business.reorder_count ?? 0))} icon={ShoppingCart} />
        <Metric label="DN" value={formatCompactPercent(Number(assortment.distribution_rate ?? 0))} icon={Boxes} />
        <Metric label="DN stratégique" value={formatCompactPercent(Number(assortment.strategic_distribution_rate ?? 0))} icon={Boxes} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Business & santé commerciale</CardTitle>
            <CardDescription>Commandes, valeur, cadence et signaux de risque réunis au même endroit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {business.health_status ? <Badge variant={business.health_status === "at_risk" || business.health_status === "dormant" ? "destructive" : "secondary"}>{presentationLabel(business.health_status)}</Badge> : null}
              {business.priority_score != null ? <Badge variant="outline">Priorité {business.priority_score}/100</Badge> : null}
              {account.potential_level ? <Badge variant="outline">Potentiel {presentationLabel(account.potential_level)}</Badge> : null}
              {account.priority_level ? <Badge variant="outline">Compte {presentationLabel(account.priority_level)}</Badge> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Mini label="Panier moyen" value={formatCompactCurrency(Number(business.average_order_value ?? 0))} />
              <Mini label="Dernière commande" value={dateLabel(business.last_order_at)} />
              <Mini label="Réassort attendu" value={dateLabel(business.expected_reorder_at)} />
              <Mini label="Cadence" value={business.expected_interval_days ? `${business.expected_interval_days} j` : "—"} />
            </div>
            {business.priority_reasons?.length ? <div className="rounded-xl bg-muted/40 p-4"><p className="font-semibold">Pourquoi ce compte mérite l’attention</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{business.priority_reasons.slice(0, 5).map((reason) => <li key={reason}>• {reason}</li>)}</ul></div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Compte</CardTitle><CardDescription>Contexte commercial et propriétaire du compte.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Territoire" value={account.territory_name || "Non affecté"} />
            <Info label="Responsable" value={account.agent_name || "Non affecté"} />
            <Info label="Statut" value={account.commercial_status ? presentationLabel(account.commercial_status) : "—"} />
            <Info label="Groupement" value={account.group_name || "Indépendante / non renseigné"} />
            <Info label="CIP" value={account.cip_code || "—"} />
            <Info label="Prochaine action" value={account.next_action_at ? dateLabel(account.next_action_at) : "Non planifiée"} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Assortiment & distribution</CardTitle><CardDescription>{assortment.implanted_product_count} produit(s) implanté(s) sur {assortment.eligible_product_count} éligible(s).</CardDescription></CardHeader>
        <CardContent>
          {assortment.products.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{assortment.products.map((product) => (
            <div key={product.product_id} className="rounded-xl border p-3 text-sm">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold">{product.name}</p>{product.status ? <Badge variant="secondary">{presentationLabel(product.status)}</Badge> : null}</div>
              <p className="mt-1 text-xs text-muted-foreground">{product.sku || product.ean || "Référence non renseignée"}</p>
              <p className="mt-2 text-xs text-muted-foreground">Dernière commande : {dateLabel(product.last_ordered_at)}</p>
            </div>
          ))}</div> : <p className="text-sm text-muted-foreground">Aucun produit présent dans l’assortiment consolidé.</p>}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Terrain</CardTitle><CardDescription>Interactions, missions et tâches ouvertes.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Stream title="Dernières interactions" rows={snapshot.field.interactions} primaryKey="subject" dateKey="occurred_at" empty="Aucune interaction récente." />
            <Stream title="Missions" rows={snapshot.field.missions} primaryKey="title" dateKey="scheduled_start_at" empty="Aucune mission récente." />
            <Stream title="Actions ouvertes" rows={snapshot.field.open_tasks} primaryKey="title" dateKey="due_at" empty="Aucune action ouverte." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trade Marketing</CardTitle><CardDescription>Campagnes qui ciblent directement cette pharmacie.</CardDescription></CardHeader>
          <CardContent>
            {!snapshot.trade.enabled ? <ModuleDisabled label="Trade Marketing" /> : snapshot.trade.campaigns.length ? <div className="space-y-2">{snapshot.trade.campaigns.map((campaign, index) => (
              <div key={stringValue(campaign, "id") || index} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{stringValue(campaign, "name") || "Campagne"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{presentationLabel(stringValue(campaign, "campaign_type") || "other")} · {presentationLabel(stringValue(campaign, "status") || "planned")}</p>
              </div>
            ))}</div> : <p className="text-sm text-muted-foreground">Aucune campagne ne cible ce compte.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sell-out</CardTitle><CardDescription>Lecture consolidée des relevés validés, sans mélanger les niveaux de qualité.</CardDescription></CardHeader>
          <CardContent>
            {!snapshot.sell_out.enabled ? <ModuleDisabled label="Sell-out" /> : <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3"><Mini label="Unités 90 j" value={formatCompactNumber(Number(snapshot.sell_out.units_last_90d ?? 0))} /><Mini label="CA 90 j HT" value={formatCompactCurrency(Number(snapshot.sell_out.revenue_last_90d_ht ?? 0))} /></div>
              <p className="text-sm text-muted-foreground">{snapshot.sell_out.validated_capture_count} relevé(s) validé(s).</p>
              {snapshot.sell_out.latest_captures.slice(0, 3).map((capture, index) => <div key={stringValue(capture, "id") || index} className="rounded-xl border p-3 text-xs"><p className="font-semibold">{presentationLabel(stringValue(capture, "quality") || "imported")}</p><p className="mt-1 text-muted-foreground">{stringValue(capture, "period_start") || "—"} → {stringValue(capture, "period_end") || "—"}</p></div>)}
            </div>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Opportunités & prochaine décision</CardTitle><CardDescription>La couche Next Best Action reste explicable et ne crée aucune tâche automatiquement.</CardDescription></div>
            {snapshot.capabilities.next_best_action ? <Button asChild variant="outline" size="sm"><Link href="/dashboard/commercial-health">Ouvrir les priorités</Link></Button> : null}
          </div>
        </CardHeader>
        <CardContent>
          {!snapshot.capabilities.next_best_action ? <ModuleDisabled label="Next Best Action" /> : snapshot.opportunities.length ? <div className="grid gap-3 md:grid-cols-2">{snapshot.opportunities.map((opportunity) => (
            <div key={`${opportunity.brand_pharmacy_id}-${opportunity.action_type}`} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2"><Sparkles className="size-4 text-[var(--tr1-orange)]" /><Badge>Score {opportunity.action_score}/100</Badge><Badge variant="secondary">Confiance {confidenceLabel(opportunity.confidence)}</Badge></div>
              <p className="mt-3 font-semibold">{opportunity.action_label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Échéance proposée : {dateLabel(opportunity.suggested_due_at)}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{opportunity.rationale.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}</ul>
            </div>
          ))}</div> : <p className="text-sm text-muted-foreground">Aucune action prioritaire n’est recommandée à date.</p>}
        </CardContent>
      </Card>

      <aside className="grid gap-3 sm:grid-cols-3">
        <Coverage label="Business" active={coverage.business} icon={TrendingUp} />
        <Coverage label="Terrain" active={coverage.field} icon={CalendarDays} />
        <Coverage label="Trade / sell-out" active={coverage.trade || coverage.sellOut} icon={Megaphone} />
      </aside>
    </main>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Building2 }) {
  return <Card><CardContent className="pt-5"><div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div><Icon className="size-4 text-[var(--tr1-orange)]" /></div></CardContent></Card>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function Stream({ title, rows, primaryKey, dateKey, empty }: { title: string; rows: Array<Record<string, unknown>>; primaryKey: string; dateKey: string; empty: string }) {
  return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{rows.length ? <div className="space-y-2">{rows.slice(0, 3).map((row, index) => <div key={stringValue(row, "id") || index} className="rounded-lg border p-2 text-sm"><p className="font-medium">{stringValue(row, primaryKey) || "Événement"}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(stringValue(row, dateKey))}</p></div>)}</div> : <p className="text-xs text-muted-foreground">{empty}</p>}</div>;
}

function ModuleDisabled({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Le module {label} n’est pas activé pour cette marque.</div>;
}

function Coverage({ label, active, icon: Icon }: { label: string; active: boolean; icon: typeof Building2 }) {
  return <Card><CardContent className="flex items-center gap-3 pt-5"><Icon className={active ? "text-[#176b45]" : "text-muted-foreground"} /><div><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{active ? "Données disponibles" : "Pas encore de signal consolidé"}</p></div></CardContent></Card>;
}
