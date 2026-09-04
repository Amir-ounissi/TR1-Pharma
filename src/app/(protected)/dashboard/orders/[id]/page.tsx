import { notFound } from "next/navigation";
import Link from "next/link";
import {
  OrderRevisionForm,
  OrderStatusForm,
} from "@/components/orders/order-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCurrency } from "@/lib/reference-data";
import {
  translateUiMessage,
  uiLabel,
} from "@/lib/ui-copy";

type Params = Promise<{ id: string }>;

export default async function OrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();

  const contexts = await getBrandContexts();
  const role =
    contexts.find((context) => context.id === brand.id)?.role ??
    "brand_user";

  const isAgent = role === "agent";
  const canOperate = [
    "tr1_manager",
    "brand_admin",
    "super_admin",
  ].includes(role);

  const canViewPayment = [
    "tr1_manager",
    "brand_admin",
    "brand_user",
    "super_admin",
  ].includes(role);

  const [
    { data: order },
    { data: items },
    { data: logs },
    { data: anomaly },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*,pharmacies(legal_name,trade_name,city),brand_pharmacies(id)",
      )
      .eq("id", id)
      .eq("brand_id", brand.id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at"),
    supabase
      .from("activity_logs")
      .select("id,action,created_at")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("order_anomalies")
      .select("*")
      .eq("order_id", id)
      .maybeSingle(),
    supabase
      .from("products")
      .select(
        "id,name,sku,wholesale_price_ht,tax_rate,units_per_case,minimum_order_quantity",
      )
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null)
      .order("name"),
  ]);

  if (!order) notFound();

  const pharmacy = Array.isArray(order.pharmacies)
    ? order.pharmacies[0]
    : order.pharmacies;

  const canEdit =
    (isAgent &&
      ["draft", "needs_correction"].includes(order.order_status)) ||
    (canOperate && order.order_status === "draft");

  const productOptions = (products ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    detail: product.sku,
    price: product.wholesale_price_ht,
    taxRate: product.tax_rate,
    unitsPerCase: product.units_per_case,
    minimumOrderQuantity: product.minimum_order_quantity,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {order.order_number ||
              order.external_order_id ||
              `Commande ${order.id.slice(0, 8)}`}
          </h1>
          <p className="text-muted-foreground">
            {pharmacy?.trade_name || pharmacy?.legal_name} ·{" "}
            {new Date(order.order_date).toLocaleString("fr-FR")}
          </p>
        </div>

        <Button asChild variant="outline">
          <Link
            href={`/dashboard/pharmacies/${order.brand_pharmacy_id}?tab=orders`}
          >
            Voir la pharmacie
          </Link>
        </Button>
      </div>

      {anomaly ? (
        <Card className="border-destructive">
          <CardContent className="pt-5 text-destructive">
            {translateUiMessage(anomaly.description)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {canEdit ? "Modifier la commande" : "Lignes figées"}
              </CardTitle>
            </CardHeader>

            <CardContent className={canEdit ? "" : "p-0"}>
              {canEdit ? (
                <OrderRevisionForm
                  orderId={order.id}
                  isAgent={isAgent}
                  order={{
                    externalOrderId: order.external_order_id,
                    orderNumber: order.order_number,
                    orderType: order.order_type,
                    orderDate: order.order_date,
                    shippingAmountHt: order.shipping_amount_ht,
                    notes: order.notes,
                    reviewNote: order.review_note,
                  }}
                  initialItems={(items ?? []).map((item) => ({
                    id: item.id,
                    productId: item.product_id,
                    quantity: item.quantity,
                    freeQuantity: item.free_quantity,
                    unitPriceHt: item.unit_price_ht,
                    discountRate: item.discount_rate,
                  }))}
                  products={productOptions}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>Gratuits</TableHead>
                      <TableHead>Prix HT</TableHead>
                      <TableHead>Remise</TableHead>
                      <TableHead>Total HT</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {(items ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">
                            {item.product_name_snapshot}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.sku_snapshot}
                          </p>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.free_quantity}</TableCell>
                        <TableCell>
                          {formatCurrency(item.unit_price_ht)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(item.discount_amount_ht)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(item.line_total_ht)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(logs ?? []).map((log) => (
                <div
                  key={log.id}
                  className="flex justify-between border-b pb-2 text-sm"
                >
                  <span>{uiLabel(log.action)}</span>
                  <time>
                    {new Date(log.created_at).toLocaleString("fr-FR")}
                  </time>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {isAgent
                  ? "Suivi de la commande"
                  : order.order_status === "pending" && canOperate
                    ? "Décision marque"
                    : "Statut"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusForm
                orderId={order.id}
                currentStatus={order.order_status}
                isAgent={isAgent}
                canOperate={canOperate}
                reviewNote={order.review_note}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Montants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex justify-between">
                <span>Sous-total HT</span>
                <strong>{formatCurrency(order.subtotal_ht)}</strong>
              </p>
              <p className="flex justify-between">
                <span>Remises</span>
                <strong>
                  {formatCurrency(order.discount_amount_ht)}
                </strong>
              </p>
              <p className="flex justify-between">
                <span>Net HT</span>
                <strong>{formatCurrency(order.net_amount_ht)}</strong>
              </p>
              <p className="flex justify-between">
                <span>Taxes</span>
                <strong>{formatCurrency(order.tax_amount)}</strong>
              </p>
              <p className="flex justify-between text-base">
                <span>Total TTC</span>
                <strong>{formatCurrency(order.total_ttc)}</strong>
              </p>

              {canViewPayment ? (
                <p className="flex justify-between">
                  <span>Règlement</span>
                  <strong>
                    {order.payment_status === "not_applicable"
                      ? "Non connecté"
                      : uiLabel(order.payment_status)}
                  </strong>
                </p>
              ) : null}

              <Badge>
                {order.is_initial_order
                  ? "Implantation"
                  : order.is_reorder
                    ? "Réassort"
                    : uiLabel(order.order_type)}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
