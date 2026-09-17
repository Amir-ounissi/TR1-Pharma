import Link from "next/link";
import { CheckCircle2, ClipboardList, Home, Store } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export default async function OrderConfirmationPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id,order_status,order_number,external_order_id,order_date,brand_pharmacy_id,pharmacies(legal_name,trade_name,city)",
    )
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (!order) notFound();

  const pharmacy = Array.isArray(order.pharmacies)
    ? order.pharmacies[0]
    : order.pharmacies;
  const pharmacyName =
    pharmacy?.trade_name || pharmacy?.legal_name || "la pharmacie";
  const reference =
    order.order_number || order.external_order_id || `Commande ${order.id.slice(0, 8)}`;
  const isPending = order.order_status === "pending";

  const title = isPending
    ? "Commande prête à transmettre"
    : order.order_status === "draft"
      ? "Commande enregistrée en brouillon"
      : "Commande validée";

  const description = isPending
    ? `La commande pour ${pharmacyName} est bien enregistrée dans TR1. Vérifiez maintenant le bon de commande puis envoyez-le réellement par email à la marque.`
    : order.order_status === "draft"
      ? `Le brouillon pour ${pharmacyName} a bien été enregistré.`
      : `La commande pour ${pharmacyName} a bien été enregistrée.`;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center py-4 sm:py-10">
      <Card className="w-full overflow-hidden border-[var(--tr1-success)]/25 shadow-lg">
        <CardContent className="p-6 text-center sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--tr1-success)]/10 text-[var(--tr1-success)] sm:size-20">
            <CheckCircle2 className="size-9 sm:size-11" strokeWidth={2.25} />
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
            Commande enregistrée
          </p>
          <h1 className="mt-2 text-2xl font-black text-[var(--tr1-navy)] sm:text-3xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>

          <div className="mx-auto mt-6 max-w-md rounded-2xl border bg-muted/20 px-4 py-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Référence
            </p>
            <p className="mt-1 font-black text-[var(--tr1-navy)]">{reference}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pharmacyName}
              {pharmacy?.city ? ` · ${pharmacy.city}` : ""}
            </p>
          </div>

          {isPending ? (
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                className="h-12 rounded-xl bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)]"
              >
                <Link href={`/dashboard/orders/${order.id}#transmission-commande`}>
                  <ClipboardList className="size-4" />
                  Prévisualiser et envoyer le BDC
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-xl">
                <Link href="/dashboard">
                  <Home className="size-4" />
                  Retour au tableau de bord
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                className="h-12 rounded-xl bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)]"
              >
                <Link href="/dashboard">
                  <Home className="size-4" />
                  Retour au tableau de bord
                </Link>
              </Button>

              {order.brand_pharmacy_id ? (
                <Button asChild variant="outline" className="h-12 rounded-xl">
                  <Link href={`/dashboard/pharmacies/${order.brand_pharmacy_id}`}>
                    <Store className="size-4" />
                    Voir la pharmacie
                  </Link>
                </Button>
              ) : null}
            </div>
          )}

          {isPending && order.brand_pharmacy_id ? (
            <Button asChild variant="ghost" className="mt-3 h-11 rounded-xl">
              <Link href={`/dashboard/pharmacies/${order.brand_pharmacy_id}`}>
                <Store className="size-4" />
                Voir la pharmacie
              </Link>
            </Button>
          ) : null}

          {!isPending ? (
            <Button asChild variant="ghost" className="mt-3 h-11 rounded-xl">
              <Link href={`/dashboard/orders/${order.id}`}>
                <ClipboardList className="size-4" />
                Voir le détail de la commande
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
