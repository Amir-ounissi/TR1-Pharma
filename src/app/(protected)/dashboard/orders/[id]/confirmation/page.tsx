import Link from "next/link";
import { Building2, Check, House } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";

type Params = Promise<{ id: string }>;

function money(value: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function OrderConfirmationPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id,brand_pharmacy_id,order_number,external_order_id,order_status,net_amount_ht,total_ttc,currency_code",
    )
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !order) notFound();

  const { data: relation } = order.brand_pharmacy_id
    ? await supabase
        .from("brand_pharmacies")
        .select("id,pharmacies(legal_name,trade_name,city)")
        .eq("id", order.brand_pharmacy_id)
        .eq("brand_id", brand.id)
        .is("archived_at", null)
        .maybeSingle()
    : { data: null };

  const pharmacy = relation
    ? Array.isArray(relation.pharmacies)
      ? relation.pharmacies[0]
      : relation.pharmacies
    : null;
  const pharmacyName =
    pharmacy?.trade_name || pharmacy?.legal_name || "la pharmacie";
  const orderReference =
    order.order_number || order.external_order_id || order.id.slice(0, 8).toUpperCase();
  const isDraft = order.order_status === "draft";
  const message = isDraft
    ? "La commande a bien été enregistrée en brouillon."
    : order.order_status === "pending"
      ? "La commande a bien été enregistrée et transmise à la marque pour traitement."
      : "La commande a bien été enregistrée et transmise pour traitement.";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-xl items-center px-1 py-6 sm:px-0">
      <Card className="w-full overflow-hidden border-[var(--tr1-success)]/25 shadow-sm">
        <CardContent className="p-5 sm:p-8">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--tr1-success)]/12 text-[var(--tr1-success)]">
            <Check className="size-8 stroke-[3]" />
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tr1-success)]">
              Commande confirmée
            </p>
            <h1 className="mt-2 text-2xl font-black text-[var(--tr1-navy)] sm:text-3xl">
              Commande enregistrée
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {message}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Pharmacie
                </p>
                <p className="mt-1 truncate font-black text-[var(--tr1-navy)]">
                  {pharmacyName}
                </p>
                {pharmacy?.city ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{pharmacy.city}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Total HT
                </p>
                <p className="mt-1 text-lg font-black text-[var(--tr1-navy)]">
                  {money(Number(order.net_amount_ht ?? 0), order.currency_code || "EUR")}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Réf. commande <span className="font-semibold text-[var(--tr1-navy)]">{orderReference}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {relation?.id ? (
              <Button
                asChild
                className="h-12 rounded-xl bg-[var(--tr1-orange)] text-white hover:bg-[var(--tr1-orange)]/90"
              >
                <Link href={`/dashboard/pharmacies/${relation.id}`}>
                  <Building2 className="size-4" /> Voir la pharmacie
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                className="h-12 rounded-xl bg-[var(--tr1-orange)] text-white hover:bg-[var(--tr1-orange)]/90"
              >
                <Link href="/dashboard/pharmacies">
                  <Building2 className="size-4" /> Voir les pharmacies
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-12 rounded-xl">
              <Link href="/dashboard">
                <House className="size-4" /> Retour à l’accueil
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
