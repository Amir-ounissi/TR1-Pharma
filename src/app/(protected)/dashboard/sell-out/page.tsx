import Link from "next/link";
import { Activity, Building2, ClipboardCheck, PackageCheck, Scale } from "lucide-react";
import { saveSellOutCaptureFormAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCompactNumber, formatCompactPercent } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{ from?: string; to?: string }>;

type PharmacyRow = {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  city: string | null;
};

type CaptureRow = {
  id: string;
  brand_pharmacy_id: string;
  method: "document" | "manual" | "import" | "stock_inference";
  quality: "confirmed" | "declared" | "estimated" | "imported" | null;
  status: "draft" | "review_required" | "validated" | "rejected" | "archived";
  period_start: string;
  period_end: string;
  source_label: string | null;
  confidence: number | string | null;
  created_at: string;
};

type OverviewRow = {
  validated_captures: number;
  observed_pharmacies: number;
  active_pharmacies: number;
  coverage_rate: number;
  sell_out_units: number;
  sell_out_revenue_ht: number;
  sell_in_units: number;
  sell_in_revenue_ht: number;
  sell_out_sell_in_rate: number;
  confirmed_units: number;
  declared_units: number;
  estimated_units: number;
  imported_units: number;
};

const qualityLabels: Record<NonNullable<CaptureRow["quality"]>, string> = {
  confirmed: "Confirmé",
  declared: "Déclaré",
  estimated: "Estimé",
  imported: "Importé",
};

const methodLabels: Record<CaptureRow["method"], string> = {
  document: "Photo / PDF",
  manual: "Déclaration",
  import: "Import externe",
  stock_inference: "Inférence stock",
};

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}

function pharmacyName(row: PharmacyRow) {
  return row.trade_name || row.legal_name || "Pharmacie";
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><span className="text-xs font-medium uppercase tracking-[0.08em]">{label}</span></div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default async function SellOutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const now = new Date();
  const from = validDate(params.from, `${now.getUTCFullYear()}-01-01`);
  const to = validDate(params.to, inputDate(now));
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const canCapture = ["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role);
  const canReadOverview = ["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role);

  const [{ data: pharmacies, error: pharmaciesError }, { data: captures, error: capturesError }] = await Promise.all([
    supabase
      .from("brand_pharmacy_directory")
      .select("id,trade_name,legal_name,city")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("trade_name")
      .limit(1000),
    supabase
      .from("sell_out_captures")
      .select("id,brand_pharmacy_id,method,quality,status,period_start,period_end,source_label,confidence,created_at")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (pharmaciesError) throw pharmaciesError;
  if (capturesError) throw capturesError;

  let overview: OverviewRow | null = null;
  if (canReadOverview) {
    const { data, error } = await supabase.rpc("get_sell_out_overview", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
    });
    if (error) throw error;
    overview = ((data ?? [])[0] ?? null) as OverviewRow | null;
  }

  const pharmacyRows = (pharmacies ?? []) as PharmacyRow[];
  const captureRows = (captures ?? []) as CaptureRow[];
  const pharmacyById = new Map(pharmacyRows.map((row) => [row.id, row]));
  const pendingCount = captureRows.filter((capture) => capture.status === "review_required").length;

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Sell-out · ${brand.name}`}
        title="Mesurer ce qui sort réellement de l’officine"
        description="Les relevés documentés, déclarés, importés et estimés restent séparés. Une extraction de document ne devient jamais une donnée confirmée avant validation humaine."
        tone="dark"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Confirmé</CardTitle><CardDescription>Photo ou PDF relu puis validé.</CardDescription></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Déclaré</CardTitle><CardDescription>Saisie terrain ou déclaration de l’équipe officinale.</CardDescription></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Estimé</CardTitle><CardDescription>Stock précédent + livraisons − stock actuel.</CardDescription></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Importé</CardTitle><CardDescription>Donnée issue d’un système externe, sans la requalifier.</CardDescription></CardHeader></Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_34rem]">
        <Card>
          <CardContent className="pt-6">
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Du</span><input className="h-10 w-full rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} /></label>
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Au</span><input className="h-10 w-full rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} /></label>
              <Button className="self-end">Appliquer</Button>
            </form>
          </CardContent>
        </Card>

        {canCapture ? (
          <details className="rounded-xl border bg-background p-4">
            <summary className="cursor-pointer font-semibold">Saisir un relevé</summary>
            <form action={saveSellOutCaptureFormAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2"><span>Pharmacie</span><select required name="brandPharmacyId" className="h-10 w-full rounded-md border bg-background px-3" defaultValue=""><option value="" disabled>Choisir une pharmacie</option>{pharmacyRows.map((row) => <option key={row.id} value={row.id}>{pharmacyName(row)}{row.city ? ` · ${row.city}` : ""}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span>Source</span><select name="method" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="manual"><option value="manual">Déclaration terrain</option><option value="document">Photo / PDF</option><option value="stock_inference">Inférence par stock</option><option value="import">Import externe</option></select></label>
              <label className="space-y-1 text-sm"><span>Confiance (0–1)</span><input name="confidence" type="number" min="0" max="1" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" placeholder="0,90" /></label>
              <label className="space-y-1 text-sm"><span>Début période</span><input required name="periodStart" type="date" defaultValue={to} className="h-10 w-full rounded-md border bg-background px-3" /></label>
              <label className="space-y-1 text-sm"><span>Fin période</span><input required name="periodEnd" type="date" defaultValue={to} className="h-10 w-full rounded-md border bg-background px-3" /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span>Source / contexte</span><input name="sourceLabel" maxLength={300} className="h-10 w-full rounded-md border bg-background px-3" placeholder="Ex. relevé caisse communiqué lors de la visite" /></label>
              <p className="text-xs text-muted-foreground sm:col-span-2">Ne saisissez aucune donnée patient ou client. Les justificatifs doivent être recadrés sur les informations produit/vente utiles.</p>
              <Button type="submit" className="sm:col-span-2">Créer le relevé</Button>
            </form>
          </details>
        ) : null}
      </div>

      {overview ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Building2} label="Couverture panel" value={formatCompactPercent(Number(overview.coverage_rate ?? 0))} detail={`${overview.observed_pharmacies ?? 0} pharmacies observées / ${overview.active_pharmacies ?? 0}`} />
          <MetricCard icon={PackageCheck} label="Sell-out" value={formatCompactNumber(Number(overview.sell_out_units ?? 0))} detail={`${overview.validated_captures ?? 0} relevés validés`} />
          <MetricCard icon={Activity} label="Sell-in" value={formatCompactNumber(Number(overview.sell_in_units ?? 0))} detail={`Unités livrées du ${from} au ${to}`} />
          <MetricCard icon={Scale} label="Sell-out / sell-in" value={formatCompactPercent(Number(overview.sell_out_sell_in_rate ?? 0))} detail="Lecture indicative sur le panel observé" />
          <MetricCard icon={ClipboardCheck} label="À relire" value={formatCompactNumber(pendingCount)} detail="Relevés en attente de validation" />
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <MetricCard icon={ClipboardCheck} label="Mes relevés" value={formatCompactNumber(captureRows.length)} detail="Relevés visibles sur mon portefeuille" />
          <MetricCard icon={Activity} label="À valider" value={formatCompactNumber(pendingCount)} detail="Relecture humaine requise" />
        </section>
      )}

      {overview ? (
        <Card>
          <CardHeader><CardTitle>Qualité des unités sell-out validées</CardTitle><CardDescription>Les catégories de fiabilité ne sont jamais fusionnées en une seule qualité implicite.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Confirmé</p><p className="text-xl font-semibold">{formatCompactNumber(Number(overview.confirmed_units ?? 0))}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Déclaré</p><p className="text-xl font-semibold">{formatCompactNumber(Number(overview.declared_units ?? 0))}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Estimé</p><p className="text-xl font-semibold">{formatCompactNumber(Number(overview.estimated_units ?? 0))}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Importé</p><p className="text-xl font-semibold">{formatCompactNumber(Number(overview.imported_units ?? 0))}</p></div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Relevés récents</CardTitle><CardDescription>Chaque relevé conserve sa source, sa période, son niveau de confiance et son statut de revue.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {captureRows.length === 0 ? <p className="p-8 text-center text-muted-foreground">Aucun relevé sell-out pour le moment.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>Source</TableHead><TableHead>Période</TableHead><TableHead>Qualité</TableHead><TableHead>Statut</TableHead><TableHead>Confiance</TableHead></TableRow></TableHeader>
              <TableBody>{captureRows.map((capture) => {
                const pharmacy = pharmacyById.get(capture.brand_pharmacy_id);
                return <TableRow key={capture.id}>
                  <TableCell><Link href={`/dashboard/sell-out/${capture.id}`} className="font-semibold hover:underline">{pharmacy ? pharmacyName(pharmacy) : "Pharmacie"}</Link><p className="text-xs text-muted-foreground">{capture.source_label || methodLabels[capture.method]}</p></TableCell>
                  <TableCell>{methodLabels[capture.method]}</TableCell>
                  <TableCell>{capture.period_start} → {capture.period_end}</TableCell>
                  <TableCell>{capture.quality ? <Badge variant="outline">{qualityLabels[capture.quality]}</Badge> : <span className="text-muted-foreground">À confirmer</span>}</TableCell>
                  <TableCell><Badge variant={capture.status === "validated" ? "default" : "secondary"}>{presentationLabel(capture.status)}</Badge></TableCell>
                  <TableCell>{capture.confidence === null ? "—" : `${Math.round(Number(capture.confidence) * 100)} %`}</TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
