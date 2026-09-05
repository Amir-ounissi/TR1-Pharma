import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveSellOutCaptureFormAction,
  saveSellOutLineFormAction,
  submitSellOutCaptureFormAction,
  uploadSellOutEvidenceFormAction,
  validateSellOutCaptureFormAction,
} from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type Capture = {
  id: string;
  brand_pharmacy_id: string;
  method: "document" | "manual" | "import" | "stock_inference";
  quality: "confirmed" | "declared" | "estimated" | "imported" | null;
  status: "draft" | "review_required" | "validated" | "rejected" | "archived";
  period_start: string;
  period_end: string;
  observed_at: string;
  source_label: string | null;
  confidence: number | string | null;
  extraction_version: string | null;
  validation_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type SellOutLine = {
  id: string;
  product_id: string | null;
  source_product_code: string | null;
  ean: string | null;
  label: string | null;
  units_sold: number | null;
  revenue_ht: number | string | null;
  stock_before: number | null;
  delivered_units: number | null;
  stock_current: number | null;
  theoretical_units: number | null;
  confidence: number | string | null;
};

type Evidence = {
  id: string;
  kind: "photo" | "pdf" | "csv" | "other";
  storage_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  sha256: string | null;
  created_at: string;
};

type Product = { id: string; name: string; sku: string | null; ean: string | null };
type Pharmacy = { id: string; trade_name: string | null; legal_name: string | null; city: string | null };

const qualityLabels: Record<NonNullable<Capture["quality"]>, string> = {
  confirmed: "Confirmé",
  declared: "Déclaré",
  estimated: "Estimé",
  imported: "Importé",
};

const methodLabels: Record<Capture["method"], string> = {
  document: "Photo / PDF",
  manual: "Déclaration terrain",
  import: "Import externe",
  stock_inference: "Inférence par stock",
};

function pharmacyName(row: Pharmacy | null) {
  return row?.trade_name || row?.legal_name || "Pharmacie";
}

function byteLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function SellOutCapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const canWrite = ["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role);
  const canArchive = ["tr1_manager", "brand_admin", "super_admin"].includes(role);

  const { data: captureData, error: captureError } = await supabase
    .from("sell_out_captures")
    .select("id,brand_pharmacy_id,method,quality,status,period_start,period_end,observed_at,source_label,confidence,extraction_version,validation_notes,reviewed_at,created_at")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (captureError) throw captureError;
  if (!captureData) notFound();
  const capture = captureData as Capture;

  const [linesResult, evidenceResult, productsResult, pharmacyResult] = await Promise.all([
    supabase.from("sell_out_lines").select("id,product_id,source_product_code,ean,label,units_sold,revenue_ht,stock_before,delivered_units,stock_current,theoretical_units,confidence").eq("capture_id", id).order("created_at"),
    supabase.from("sell_out_evidence").select("id,kind,storage_path,file_name,mime_type,byte_size,sha256,created_at").eq("capture_id", id).order("created_at", { ascending: false }),
    supabase.from("products").select("id,name,sku,ean").eq("brand_id", brand.id).eq("is_active", true).order("name").limit(500),
    supabase.from("brand_pharmacy_directory").select("id,trade_name,legal_name,city").eq("id", capture.brand_pharmacy_id).eq("brand_id", brand.id).maybeSingle(),
  ]);
  for (const result of [linesResult, evidenceResult, productsResult, pharmacyResult]) if (result.error) throw result.error;

  const lines = (linesResult.data ?? []) as SellOutLine[];
  const evidence = (evidenceResult.data ?? []) as Evidence[];
  const products = (productsResult.data ?? []) as Product[];
  const pharmacy = (pharmacyResult.data ?? null) as Pharmacy | null;
  const productById = new Map(products.map((product) => [product.id, product]));
  const evidenceLinks = new Map<string, string>();
  await Promise.all(evidence.map(async (item) => {
    const { data } = await supabase.storage.from("sell-out-evidence").createSignedUrl(item.storage_path, 600);
    if (data?.signedUrl) evidenceLinks.set(item.id, data.signedUrl);
  }));

  const totalUnits = lines.reduce((sum, line) => sum + Number(line.units_sold ?? 0), 0);
  const totalRevenue = lines.reduce((sum, line) => sum + Number(line.revenue_ht ?? 0), 0);
  const editable = canWrite && ["draft", "review_required"].includes(capture.status);
  const canSubmit = canWrite && capture.status === "draft";
  const canReview = canWrite && capture.status === "review_required";

  return (
    <main className="space-y-6">
      <Button asChild size="sm" variant="outline"><Link href="/dashboard/sell-out">← Tous les relevés</Link></Button>
      <PageHeader
        eyebrow={`Sell-out · ${brand.name}`}
        title={pharmacyName(pharmacy)}
        description={`${methodLabels[capture.method]} · ${capture.period_start} → ${capture.period_end}`}
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Statut</p><div className="mt-2"><Badge variant={capture.status === "validated" ? "default" : "secondary"}>{presentationLabel(capture.status)}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Qualité</p><p className="mt-2 text-xl font-semibold">{capture.quality ? qualityLabels[capture.quality] : "À confirmer"}</p><p className="text-xs text-muted-foreground">La source reste visible dans tous les calculs.</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Unités</p><p className="mt-2 text-2xl font-semibold">{formatCompactNumber(totalUnits)}</p><p className="text-xs text-muted-foreground">{lines.length} ligne(s)</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">CA sell-out HT</p><p className="mt-2 text-xl font-semibold">{formatCompactCurrency(totalRevenue)}</p><p className="text-xs text-muted-foreground">Si renseigné par la source</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Confiance source</p><p className="mt-2 text-xl font-semibold">{capture.confidence === null ? "—" : `${Math.round(Number(capture.confidence) * 100)} %`}</p><p className="text-xs text-muted-foreground">{capture.source_label || "Source non précisée"}</p></CardContent></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Règle de fiabilité</CardTitle>
          <CardDescription>
            {capture.method === "document"
              ? "Le document sert de preuve, mais les lignes doivent être relues par un humain avant de passer en Confirmé."
              : capture.method === "stock_inference"
                ? "Les unités sont calculées par stock précédent + livraisons − stock actuel et resteront classées Estimé après validation."
                : capture.method === "manual"
                  ? "Une saisie terrain restera classée Déclaré même après validation."
                  : "Une donnée issue d’un système externe restera classée Importé afin de conserver la provenance."}
          </CardDescription>
        </CardHeader>
      </Card>

      {editable ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Ajouter une ligne produit</CardTitle><CardDescription>{capture.method === "stock_inference" ? "Renseignez les trois états de stock ; TR1 calcule les unités théoriques." : "Rapprochez le produit TR1 ou conservez le code/EAN de la source."}</CardDescription></CardHeader>
            <CardContent>
              <form action={saveSellOutLineFormAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="captureId" value={capture.id} />
                <label className="space-y-1 text-sm sm:col-span-2"><span>Produit TR1</span><select name="productId" className="h-10 w-full rounded-md border bg-background px-3" defaultValue=""><option value="">Non rapproché / produit externe</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}{product.ean ? ` · ${product.ean}` : ""}</option>)}</select></label>
                <label className="space-y-1 text-sm"><span>Code source</span><input name="sourceProductCode" maxLength={120} className="h-10 w-full rounded-md border bg-background px-3" /></label>
                <label className="space-y-1 text-sm"><span>EAN</span><input name="ean" maxLength={32} className="h-10 w-full rounded-md border bg-background px-3" /></label>
                <label className="space-y-1 text-sm sm:col-span-2"><span>Libellé source</span><input name="label" maxLength={300} className="h-10 w-full rounded-md border bg-background px-3" placeholder="Libellé tel qu’il apparaît sur le relevé" /></label>
                {capture.method === "stock_inference" ? <>
                  <label className="space-y-1 text-sm"><span>Stock précédent</span><input required name="stockBefore" type="number" min="0" step="1" className="h-10 w-full rounded-md border bg-background px-3" /></label>
                  <label className="space-y-1 text-sm"><span>Nouvelles livraisons</span><input required name="deliveredUnits" type="number" min="0" step="1" className="h-10 w-full rounded-md border bg-background px-3" /></label>
                  <label className="space-y-1 text-sm"><span>Stock actuel</span><input required name="stockCurrent" type="number" min="0" step="1" className="h-10 w-full rounded-md border bg-background px-3" /></label>
                </> : <label className="space-y-1 text-sm"><span>Unités vendues</span><input required name="unitsSold" type="number" min="0" step="1" className="h-10 w-full rounded-md border bg-background px-3" /></label>}
                <label className="space-y-1 text-sm"><span>CA HT</span><input name="revenueHt" type="number" min="0" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" /></label>
                <label className="space-y-1 text-sm"><span>Confiance ligne (0–1)</span><input name="confidence" type="number" min="0" max="1" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" /></label>
                <Button type="submit" className="sm:col-span-2">Ajouter la ligne</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Justificatif privé</CardTitle><CardDescription>JPG, PNG, PDF ou CSV · 10 Mo maximum. Aucune donnée patient/client ne doit apparaître dans le fichier.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <form action={uploadSellOutEvidenceFormAction} className="space-y-3">
                <input type="hidden" name="captureId" value={capture.id} />
                <input required name="file" type="file" accept="image/jpeg,image/png,application/pdf,text/csv,.csv" className="block w-full rounded-md border bg-background p-2 text-sm" />
                <p className="text-xs text-muted-foreground">Avant l’envoi, recadrez ou expurgez tout nom, téléphone, e-mail ou information permettant d’identifier un patient ou un client.</p>
                <Button type="submit" variant="outline" className="w-full">Ajouter le justificatif</Button>
              </form>
              {capture.method === "document" ? <p className="rounded-lg border p-3 text-xs text-muted-foreground">Le rapprochement automatique n’est pas considéré comme validé par défaut : la saisie/relecture des lignes ci-contre reste l’étape de contrôle humain.</p> : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Lignes sell-out</CardTitle><CardDescription>{capture.method === "stock_inference" ? "Les unités théoriques restent identifiées comme estimées." : "Quantités et valeur conservées au niveau du relevé."}</CardDescription></CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? <p className="p-8 text-center text-muted-foreground">Aucune ligne pour le moment.</p> : <Table>
            <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>EAN / code</TableHead><TableHead>Unités</TableHead>{capture.method === "stock_inference" ? <><TableHead>Stock précédent</TableHead><TableHead>Livraisons</TableHead><TableHead>Stock actuel</TableHead></> : null}<TableHead>CA HT</TableHead><TableHead>Confiance</TableHead></TableRow></TableHeader>
            <TableBody>{lines.map((line) => {
              const product = line.product_id ? productById.get(line.product_id) : null;
              return <TableRow key={line.id}>
                <TableCell><span className="font-medium">{product?.name || line.label || "Produit non rapproché"}</span><p className="text-xs text-muted-foreground">{product?.sku || line.source_product_code || "—"}</p></TableCell>
                <TableCell>{line.ean || product?.ean || "—"}</TableCell>
                <TableCell>{formatCompactNumber(Number(line.units_sold ?? line.theoretical_units ?? 0))}{line.theoretical_units !== null ? <p className="text-xs text-muted-foreground">théorique</p> : null}</TableCell>
                {capture.method === "stock_inference" ? <><TableCell>{line.stock_before ?? "—"}</TableCell><TableCell>{line.delivered_units ?? "—"}</TableCell><TableCell>{line.stock_current ?? "—"}</TableCell></> : null}
                <TableCell>{line.revenue_ht === null ? "—" : formatCompactCurrency(Number(line.revenue_ht))}</TableCell>
                <TableCell>{line.confidence === null ? "—" : `${Math.round(Number(line.confidence) * 100)} %`}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preuves et sources</CardTitle><CardDescription>Les fichiers sont stockés dans un bucket privé, isolé par marque et relevé.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {evidence.length === 0 ? <p className="text-sm text-muted-foreground">Aucun justificatif.</p> : evidence.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.file_name}</p><p className="text-xs text-muted-foreground">{item.kind.toUpperCase()} · {byteLabel(item.byte_size)} · SHA-256 {item.sha256?.slice(0, 12) ?? "—"}…</p></div>{evidenceLinks.get(item.id) ? <Button asChild size="sm" variant="outline"><a href={evidenceLinks.get(item.id)} target="_blank" rel="noreferrer">Ouvrir 10 min</a></Button> : null}</div>)}
        </CardContent>
      </Card>

      {canSubmit ? <Card><CardHeader><CardTitle>Envoyer en validation</CardTitle><CardDescription>Une ligne au minimum est requise. Pour une source Photo/PDF, un justificatif est obligatoire.</CardDescription></CardHeader><CardContent><form action={submitSellOutCaptureFormAction}><input type="hidden" name="captureId" value={capture.id} /><Button type="submit">Soumettre pour relecture humaine</Button></form></CardContent></Card> : null}

      {canReview ? <Card><CardHeader><CardTitle>Validation humaine</CardTitle><CardDescription>Valider fixe la qualité selon la source : document → Confirmé, manuel → Déclaré, stock → Estimé, import → Importé.</CardDescription></CardHeader><CardContent><form action={validateSellOutCaptureFormAction} className="space-y-3"><input type="hidden" name="captureId" value={capture.id} /><textarea name="notes" maxLength={5000} className="min-h-24 w-full rounded-md border bg-background p-3" placeholder="Note de relecture" /><div className="flex flex-wrap gap-2"><Button name="approved" value="true" type="submit">Valider le relevé</Button><Button name="approved" value="false" type="submit" variant="destructive">Rejeter</Button></div></form></CardContent></Card> : null}

      {capture.validation_notes || capture.reviewed_at ? <Card><CardHeader><CardTitle>Revue</CardTitle></CardHeader><CardContent className="text-sm"><p>{capture.validation_notes || "Aucune note."}</p><p className="mt-2 text-xs text-muted-foreground">Revu le {capture.reviewed_at ? new Date(capture.reviewed_at).toLocaleString("fr-FR") : "—"}</p></CardContent></Card> : null}

      {canArchive ? <form action={archiveSellOutCaptureFormAction}><input type="hidden" name="captureId" value={capture.id} /><Button type="submit" variant="ghost" className="text-muted-foreground">Archiver le relevé</Button></form> : null}
    </main>
  );
}
