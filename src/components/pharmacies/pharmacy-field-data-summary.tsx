import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SellOutLine = {
  units_sold: number | null;
  revenue_ht: number | string | null;
};

type SellOutCapture = {
  id: string;
  method: string;
  quality: string | null;
  status: string;
  period_start: string;
  period_end: string;
  observed_at: string;
  source_label: string | null;
  sell_out_lines: SellOutLine[] | null;
};

type PriceObservation = {
  id: string;
  observed_price_ttc: number | string;
  unit_price_ttc: number | string;
  price_type: string;
  capture_method: string;
  observed_at: string;
  products:
    | { name: string; retail_price_ttc: number | string | null }
    | Array<{ name: string; retail_price_ttc: number | string | null }>
    | null;
};

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

function date(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function qualityLabel(value: string | null) {
  if (value === "confirmed") return "Confirmé";
  if (value === "declared") return "Déclaré";
  if (value === "estimated") return "Estimé";
  if (value === "imported") return "Importé";
  return "À confirmer";
}

function statusLabel(value: string) {
  if (value === "validated") return "Validé";
  if (value === "review_required") return "À relire";
  if (value === "draft") return "Brouillon";
  if (value === "rejected") return "Rejeté";
  return value;
}

function priceTypeLabel(value: string) {
  if (value === "promotion") return "Promo";
  if (value === "bundle") return "Lot";
  if (value === "regular") return "Normal";
  return "Autre";
}

export function PharmacyFieldDataSummary({
  brandPharmacyId,
  sellOut,
  prices,
}: {
  brandPharmacyId: string;
  sellOut: SellOutCapture | null;
  prices: PriceObservation[];
}) {
  const lines = sellOut?.sell_out_lines ?? [];
  const units = lines.reduce((total, line) => total + Number(line.units_sold ?? 0), 0);
  const revenueHt = lines.reduce((total, line) => total + Number(line.revenue_ht ?? 0), 0);

  return (
    <Card data-testid="pharmacy-field-data-summary">
      <CardHeader>
        <CardTitle>Data terrain</CardTitle>
        <CardDescription>
          Dernières données collectées dans l’officine, avec leur provenance et leur statut.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--tr1-navy)]">Sell-out</p>
              <p className="mt-1 text-xs text-muted-foreground">Dernier relevé disponible</p>
            </div>
            {sellOut ? <Badge variant="outline">{statusLabel(sellOut.status)}</Badge> : null}
          </div>

          {sellOut ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Unités</p>
                  <p className="text-xl font-bold">{units}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CA sell-out HT</p>
                  <p className="text-xl font-bold">{money(revenueHt)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {sellOut.period_start} → {sellOut.period_end}
                {" · "}{qualityLabel(sellOut.quality)}
                {" · "}{sellOut.source_label || sellOut.method}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href={"/dashboard/sell-out/" + sellOut.id}>Voir le relevé</Link>
              </Button>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucun relevé sell-out pour cette pharmacie.
            </p>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--tr1-navy)]">Prix observés</p>
              <p className="mt-1 text-xs text-muted-foreground">3 dernières observations terrain</p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href={"/dashboard/pharmacies/" + brandPharmacyId + "/prices"}>Historique</Link>
            </Button>
          </div>

          {prices.length ? (
            <div className="mt-3 space-y-2">
              {prices.map((row) => {
                const product = Array.isArray(row.products) ? row.products[0] : row.products;
                const reference = product?.retail_price_ttc == null
                  ? null
                  : Number(product.retail_price_ttc);
                const observed = Number(row.unit_price_ttc);
                const delta = reference && reference > 0
                  ? ((observed - reference) / reference) * 100
                  : null;
                return (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product?.name || "Produit"}</p>
                      <p className="text-xs text-muted-foreground">
                        {date(row.observed_at)} · {priceTypeLabel(row.price_type)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{money(row.unit_price_ttc)}</p>
                      {delta !== null ? (
                        <p className="text-xs text-muted-foreground">
                          {delta >= 0 ? "+" : ""}{delta.toFixed(1)} % vs réf.
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucun prix observé pour cette pharmacie.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
