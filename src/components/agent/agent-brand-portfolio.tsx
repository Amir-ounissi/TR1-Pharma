import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { AgentBrandSales } from "@/lib/agent-brand-portfolio";

const amount = (value: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
}).format(value);

export function AgentBrandPortfolio({
  brands,
  activeBrandId,
  unavailable,
}: {
  brands: AgentBrandSales[];
  activeBrandId: string;
  unavailable: boolean;
}) {
  if (!brands.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="agent-brands-title">
      <div>
        <h2 id="agent-brands-title" className="text-lg font-semibold text-[var(--tr1-navy)]">
          Mes marques
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CA commandé HT du mois, par marque. Ces montants ne représentent pas les commissions TR1.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => {
          const target = "/dashboard/agent/performance";
          const href = brand.id === activeBrandId
            ? target
            : `/auth/activate-brand?brandId=${encodeURIComponent(brand.id)}&next=${encodeURIComponent(target)}`;
          return (
            <Link
              href={href}
              key={brand.id}
              prefetch={false}
              className="group rounded-[0.9rem] border border-[var(--tr1-line)] bg-white p-4 transition hover:border-[var(--tr1-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--tr1-navy)]">{brand.name}</h3>
                  {brand.id === activeBrandId ? <span className="rounded-full bg-muted px-2 py-0.5 text-[0.63rem] text-muted-foreground">Active</span> : null}
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-[var(--tr1-orange)]" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--tr1-navy)]">
                {unavailable ? "—" : amount(brand.bookedRevenueHt)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {unavailable ? "Indicateurs temporairement indisponibles" : `${brand.bookedOrders} commande${brand.bookedOrders > 1 ? "s" : ""} retenue${brand.bookedOrders > 1 ? "s" : ""}`}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
