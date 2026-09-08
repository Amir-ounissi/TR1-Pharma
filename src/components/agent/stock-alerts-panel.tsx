import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { StockAlert } from "@/lib/stock-alerts-server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function StockAlertsPanel({ alerts }: { alerts: StockAlert[] }) {
  if (!alerts.length) return null;

  const visibleAlerts = alerts.slice(0, 6);
  return (
    <section className="space-y-3" aria-labelledby="stock-alerts-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#c9562d]">Sell-out · stock</p>
          <h2 id="stock-alerts-title" className="text-xl font-semibold text-[var(--tr1-navy)]">Références à surveiller</h2>
          <p className="mt-1 text-sm text-muted-foreground">Uniquement à partir de relevés validés de 45 jours ou moins.</p>
        </div>
        <Badge variant="destructive">{alerts.length}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleAlerts.map((alert) => (
          <Card key={`${alert.brand_pharmacy_id}-${alert.product_name}`} className="border-[#f0c5b5] bg-[#fff8f4]">
            <CardContent className="space-y-2 py-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#c9562d]" />
                <div className="min-w-0">
                  <Link href={`/dashboard/pharmacies/${alert.brand_pharmacy_id}`} className="font-semibold text-[var(--tr1-navy)] hover:underline">
                    {alert.pharmacy_name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">{alert.product_name} · stock {alert.stock_current}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#c9562d]">Couverture estimée : {alert.days_until_rupture} jour{alert.days_until_rupture > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">Moyenne récente : {alert.monthly_average.toFixed(1)} u./mois · relevé du {formatDate(alert.last_updated)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {alerts.length > visibleAlerts.length ? (
        <p className="text-xs text-muted-foreground">{alerts.length - visibleAlerts.length} autre{alerts.length - visibleAlerts.length > 1 ? "s" : ""} alerte{alerts.length - visibleAlerts.length > 1 ? "s" : ""} disponible{alerts.length - visibleAlerts.length > 1 ? "s" : ""} dans les fiches pharmacies.</p>
      ) : null}
    </section>
  );
}
