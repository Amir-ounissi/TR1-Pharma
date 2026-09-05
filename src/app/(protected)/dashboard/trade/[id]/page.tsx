import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveTradeCampaignFormAction,
  saveTradeCampaignFormAction,
  setTradeCampaignMissionFormAction,
  setTradeCampaignProductFormAction,
  setTradeCampaignTargetFormAction,
} from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent, formatMissionType } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type Campaign = {
  id: string;
  name: string;
  code: string | null;
  campaign_type: string;
  status: string;
  objective: string | null;
  starts_on: string;
  ends_on: string;
  budget_planned_ht: number;
  notes: string | null;
};

type CampaignMetric = {
  campaign_id: string;
  target_pharmacies: number;
  executed_pharmacies: number;
  coverage_rate: number;
  linked_missions: number;
  completed_missions: number;
  animations_completed: number;
  trainings_completed: number;
  actual_cost_ht: number;
  sell_out_units: number;
  eligible_observations: number;
  baseline_revenue_30d: number;
  post_revenue_30d: number;
  observed_incremental_revenue_ht: number;
  gross_margin_rate: number | null;
  estimated_incremental_margin_ht: number | null;
  observed_roi_percent: number | null;
  roi_reliability: "insufficient" | "partial" | "observed";
};

type PharmacyOption = {
  id: string;
  potential_level: string | null;
  potential_score: number | null;
  pharmacies: { trade_name: string | null; legal_name: string | null; city: string | null } | Array<{ trade_name: string | null; legal_name: string | null; city: string | null }> | null;
};

type ProductOption = { id: string; name: string; sku: string | null };
type MissionOption = { id: string; title: string; mission_type: string; status: string; scheduled_start_at: string | null; brand_pharmacy_id: string };
type TargetRow = { brand_pharmacy_id: string; target_reason: string | null };
type CampaignProductRow = { product_id: string; target_units: number | null; target_distribution_rate: number | null };
type MissionLinkRow = { mission_id: string };

function pharmacyOf(option: PharmacyOption) {
  return Array.isArray(option.pharmacies) ? option.pharmacies[0] : option.pharmacies;
}

function reliability(value: CampaignMetric["roi_reliability"] | undefined) {
  if (value === "observed") return "Exploitable : observations J+30 sans chevauchement";
  if (value === "partial") return "Partiel : certaines missions sont trop récentes ou se chevauchent";
  return "Insuffisant : aucun ROI financier ne doit être interprété à ce stade";
}

export default async function TradeCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();
  const canManage = ["tr1_manager", "brand_admin", "super_admin"].includes(role);

  const { data: campaignData, error: campaignError } = await supabase
    .from("trade_campaigns")
    .select("id,name,code,campaign_type,status,objective,starts_on,ends_on,budget_planned_ht,notes")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaignData) notFound();
  const campaign = campaignData as Campaign;

  const [metricsResult, targetsResult, productsResult, linksResult, allLinksResult, pharmaciesResult, catalogResult, missionsResult] = await Promise.all([
    supabase.rpc("get_trade_campaign_overview", {
      target_brand_id: brand.id,
      target_period_start: campaign.starts_on,
      target_period_end: campaign.ends_on,
    }),
    supabase.from("trade_campaign_targets").select("brand_pharmacy_id,target_reason").eq("campaign_id", id),
    supabase.from("trade_campaign_products").select("product_id,target_units,target_distribution_rate").eq("campaign_id", id),
    supabase.from("trade_campaign_missions").select("mission_id").eq("campaign_id", id),
    supabase.from("trade_campaign_missions").select("mission_id").eq("brand_id", brand.id),
    supabase.from("brand_pharmacies").select("id,potential_level,potential_score,pharmacies(trade_name,legal_name,city)").eq("brand_id", brand.id).is("archived_at", null).order("potential_score", { ascending: false, nullsFirst: false }).limit(250),
    supabase.from("products").select("id,name,sku").eq("brand_id", brand.id).eq("is_active", true).order("name").limit(250),
    supabase.from("missions").select("id,title,mission_type,status,scheduled_start_at,brand_pharmacy_id").eq("brand_id", brand.id).is("archived_at", null).in("mission_type", ["animation", "training", "merchandising", "product_launch", "stock_check"]).order("scheduled_start_at", { ascending: false, nullsFirst: false }).limit(250),
  ]);

  for (const result of [metricsResult, targetsResult, productsResult, linksResult, allLinksResult, pharmaciesResult, catalogResult, missionsResult]) {
    if (result.error) throw result.error;
  }

  const metric = ((metricsResult.data ?? []) as CampaignMetric[]).find((row) => row.campaign_id === id);
  const targets = (targetsResult.data ?? []) as TargetRow[];
  const campaignProducts = (productsResult.data ?? []) as CampaignProductRow[];
  const links = (linksResult.data ?? []) as MissionLinkRow[];
  const allLinkedMissionIds = new Set(((allLinksResult.data ?? []) as MissionLinkRow[]).map((link) => link.mission_id));
  const pharmacyOptions = (pharmaciesResult.data ?? []) as unknown as PharmacyOption[];
  const productOptions = (catalogResult.data ?? []) as ProductOption[];
  const missionOptions = (missionsResult.data ?? []) as MissionOption[];
  const pharmacyById = new Map(pharmacyOptions.map((option) => [option.id, option]));
  const productById = new Map(productOptions.map((product) => [product.id, product]));
  const missionById = new Map(missionOptions.map((mission) => [mission.id, mission]));
  const targetIds = new Set(targets.map((target) => target.brand_pharmacy_id));
  const productIds = new Set(campaignProducts.map((product) => product.product_id));

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href="/dashboard/trade">← Toutes les campagnes</Link></Button></div>
      <PageHeader
        eyebrow={`Trade Marketing · ${brand.name}`}
        title={campaign.name}
        description={campaign.objective || "Campagne terrain sans objectif renseigné."}
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Statut</p><div className="mt-2"><Badge>{presentationLabel(campaign.status)}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{presentationLabel(campaign.campaign_type)} · {campaign.starts_on} → {campaign.ends_on}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Ciblage</p><p className="mt-2 text-2xl font-semibold">{metric?.executed_pharmacies ?? 0} / {metric?.target_pharmacies ?? 0}</p><p className="text-xs text-muted-foreground">{formatCompactPercent(metric?.coverage_rate ?? 0)} exécuté</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Terrain</p><p className="mt-2 text-2xl font-semibold">{metric?.completed_missions ?? 0}</p><p className="text-xs text-muted-foreground">{metric?.animations_completed ?? 0} animation(s) · {metric?.trainings_completed ?? 0} formation(s)</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Budget / coût</p><p className="mt-2 text-xl font-semibold">{formatCompactCurrency(campaign.budget_planned_ht)}</p><p className="text-xs text-muted-foreground">Coût observé {formatCompactCurrency(metric?.actual_cost_ht ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Écart CA J+30</p><p className="mt-2 text-xl font-semibold">{formatCompactCurrency(metric?.observed_incremental_revenue_ht ?? 0)}</p><p className="text-xs text-muted-foreground">{metric?.eligible_observations ?? 0} observation(s) exploitable(s)</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">ROI observé estimé</p><p className="mt-2 text-xl font-semibold">{metric?.observed_roi_percent == null ? "—" : formatCompactPercent(metric.observed_roi_percent)}</p><p className="text-xs text-muted-foreground">{reliability(metric?.roi_reliability)}</p></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Lecture du ROI</CardTitle><CardDescription>Ce calcul n’attribue pas automatiquement la hausse de CA à la campagne. Il compare le CA J+30 après mission au J-30 avant mission, exclut les observations trop récentes, insuffisantes ou avec missions chevauchantes, puis applique la marge brute configurée avant de retrancher le coût terrain.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><p className="text-muted-foreground">CA J-30 comparable</p><strong>{formatCompactCurrency(metric?.baseline_revenue_30d ?? 0)}</strong></div>
          <div><p className="text-muted-foreground">CA J+30 comparable</p><strong>{formatCompactCurrency(metric?.post_revenue_30d ?? 0)}</strong></div>
          <div><p className="text-muted-foreground">Marge brute configurée</p><strong>{metric?.gross_margin_rate == null ? "Non renseignée" : formatCompactPercent(metric.gross_margin_rate)}</strong></div>
          <div><p className="text-muted-foreground">Marge incrémentale estimée</p><strong>{metric?.estimated_incremental_margin_ht == null ? "—" : formatCompactCurrency(metric.estimated_incremental_margin_ht)}</strong></div>
        </CardContent>
      </Card>

      {canManage ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Ajouter une pharmacie cible</CardTitle><CardDescription>Le ciblage reste limité au portefeuille de la marque.</CardDescription></CardHeader>
            <CardContent>
              <form action={setTradeCampaignTargetFormAction} className="space-y-3">
                <input type="hidden" name="campaignId" value={id} /><input type="hidden" name="included" value="true" />
                <select required className="h-10 w-full rounded-md border bg-background px-3" name="brandPharmacyId" defaultValue=""><option value="" disabled>Choisir une pharmacie</option>{pharmacyOptions.filter((option) => !targetIds.has(option.id)).map((option) => { const pharmacy = pharmacyOf(option); return <option key={option.id} value={option.id}>{pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}{pharmacy?.city ? ` · ${pharmacy.city}` : ""}</option>; })}</select>
                <input className="h-10 w-full rounded-md border bg-background px-3" name="reason" maxLength={1000} placeholder="Motif de ciblage" />
                <Button className="w-full">Ajouter au ciblage</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ajouter un produit</CardTitle><CardDescription>Objectif volume et/ou DN par référence.</CardDescription></CardHeader>
            <CardContent>
              <form action={setTradeCampaignProductFormAction} className="space-y-3">
                <input type="hidden" name="campaignId" value={id} /><input type="hidden" name="included" value="true" />
                <select required className="h-10 w-full rounded-md border bg-background px-3" name="productId" defaultValue=""><option value="" disabled>Choisir un produit</option>{productOptions.filter((product) => !productIds.has(product.id)).map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select>
                <div className="grid grid-cols-2 gap-2"><input min="0" step="1" className="h-10 rounded-md border bg-background px-3" name="targetUnits" type="number" placeholder="Unités" /><input min="0" max="100" step="0.1" className="h-10 rounded-md border bg-background px-3" name="targetDistributionRate" type="number" placeholder="DN cible %" /></div>
                <Button className="w-full">Ajouter le produit</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rattacher une mission</CardTitle><CardDescription>Une mission ne peut alimenter qu’une seule campagne afin d’éviter le double comptage.</CardDescription></CardHeader>
            <CardContent>
              <form action={setTradeCampaignMissionFormAction} className="space-y-3">
                <input type="hidden" name="campaignId" value={id} /><input type="hidden" name="linked" value="true" />
                <select required className="h-10 w-full rounded-md border bg-background px-3" name="missionId" defaultValue=""><option value="" disabled>Choisir une mission</option>{missionOptions.filter((mission) => !allLinkedMissionIds.has(mission.id)).map((mission) => <option key={mission.id} value={mission.id}>{mission.title} · {formatMissionType(mission.mission_type)} · {presentationLabel(mission.status)}</option>)}</select>
                <Button className="w-full">Rattacher à la campagne</Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Pharmacies ciblées</CardTitle><CardDescription>{targets.length} pharmacie(s)</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {targets.length === 0 ? <p className="text-sm text-muted-foreground">Aucune cible.</p> : targets.map((target) => { const option = pharmacyById.get(target.brand_pharmacy_id); const pharmacy = option ? pharmacyOf(option) : null; return <div key={target.brand_pharmacy_id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}</p><p className="text-xs text-muted-foreground">{pharmacy?.city ?? ""}{option?.potential_level ? ` · potentiel ${presentationLabel(option.potential_level)}` : ""}</p>{target.target_reason ? <p className="mt-1 text-xs">{target.target_reason}</p> : null}</div>{canManage ? <form action={setTradeCampaignTargetFormAction}><input type="hidden" name="campaignId" value={id} /><input type="hidden" name="brandPharmacyId" value={target.brand_pharmacy_id} /><input type="hidden" name="included" value="false" /><Button size="sm" variant="ghost">Retirer</Button></form> : null}</div></div>; })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Produits campagne</CardTitle><CardDescription>{campaignProducts.length} référence(s)</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {campaignProducts.length === 0 ? <p className="text-sm text-muted-foreground">Aucun produit ciblé.</p> : campaignProducts.map((item) => { const product = productById.get(item.product_id); return <div key={item.product_id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{product?.name ?? "Produit"}</p><p className="text-xs text-muted-foreground">{item.target_units == null ? "Pas d’objectif volume" : `${formatCompactNumber(item.target_units)} unités`}{item.target_distribution_rate == null ? "" : ` · DN ${formatCompactPercent(item.target_distribution_rate)}`}</p></div>{canManage ? <form action={setTradeCampaignProductFormAction}><input type="hidden" name="campaignId" value={id} /><input type="hidden" name="productId" value={item.product_id} /><input type="hidden" name="included" value="false" /><Button size="sm" variant="ghost">Retirer</Button></form> : null}</div></div>; })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Missions rattachées</CardTitle><CardDescription>{links.length} mission(s)</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {links.length === 0 ? <p className="text-sm text-muted-foreground">Aucune mission rattachée.</p> : links.map((link) => { const mission = missionById.get(link.mission_id); return <div key={link.mission_id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{mission?.title ?? "Mission"}</p><p className="text-xs text-muted-foreground">{mission ? `${formatMissionType(mission.mission_type)} · ${presentationLabel(mission.status)}` : "Mission historique"}</p></div>{canManage ? <form action={setTradeCampaignMissionFormAction}><input type="hidden" name="campaignId" value={id} /><input type="hidden" name="missionId" value={link.mission_id} /><input type="hidden" name="linked" value="false" /><Button size="sm" variant="ghost">Détacher</Button></form> : null}</div></div>; })}
          </CardContent>
        </Card>
      </section>

      {canManage ? (
        <details className="rounded-xl border bg-background p-4">
          <summary className="cursor-pointer font-semibold">Paramètres de campagne</summary>
          <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_auto]">
            <form action={saveTradeCampaignFormAction} className="grid gap-3 md:grid-cols-3">
              <input type="hidden" name="campaignId" value={id} />
              <label className="space-y-1 text-sm md:col-span-2"><span>Nom</span><input required minLength={2} maxLength={160} className="h-10 w-full rounded-md border bg-background px-3" name="name" defaultValue={campaign.name} /></label>
              <label className="space-y-1 text-sm"><span>Code</span><input maxLength={64} className="h-10 w-full rounded-md border bg-background px-3" name="code" defaultValue={campaign.code ?? ""} /></label>
              <label className="space-y-1 text-sm"><span>Type</span><select className="h-10 w-full rounded-md border bg-background px-3" name="campaignType" defaultValue={campaign.campaign_type}>{["activation","launch","animation","training","merchandising","visibility","sell_out","sampling","promotion","other"].map((value) => <option key={value} value={value}>{presentationLabel(value)}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span>Statut</span><select className="h-10 w-full rounded-md border bg-background px-3" name="status" defaultValue={campaign.status}>{["draft","planned","active","completed","cancelled"].map((value) => <option key={value} value={value}>{presentationLabel(value)}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span>Budget HT</span><input required min="0" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" name="budgetPlannedHt" type="number" defaultValue={campaign.budget_planned_ht} /></label>
              <label className="space-y-1 text-sm"><span>Début</span><input required className="h-10 w-full rounded-md border bg-background px-3" name="startsOn" type="date" defaultValue={campaign.starts_on} /></label>
              <label className="space-y-1 text-sm"><span>Fin</span><input required className="h-10 w-full rounded-md border bg-background px-3" name="endsOn" type="date" defaultValue={campaign.ends_on} /></label>
              <label className="space-y-1 text-sm md:col-span-3"><span>Objectif</span><textarea maxLength={2000} className="min-h-20 w-full rounded-md border bg-background p-3" name="objective" defaultValue={campaign.objective ?? ""} /></label>
              <label className="space-y-1 text-sm md:col-span-3"><span>Notes</span><textarea maxLength={5000} className="min-h-16 w-full rounded-md border bg-background p-3" name="notes" defaultValue={campaign.notes ?? ""} /></label>
              <Button className="md:col-span-3">Enregistrer</Button>
            </form>
            <form action={archiveTradeCampaignFormAction} className="self-end"><input type="hidden" name="campaignId" value={id} /><Button variant="destructive">Archiver la campagne</Button></form>
          </div>
        </details>
      ) : null}
    </main>
  );
}
