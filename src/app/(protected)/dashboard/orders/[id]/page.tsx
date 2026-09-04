import { notFound } from "next/navigation";
import Link from "next/link";
import { OrderStatusForm } from "@/components/orders/order-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";
import { formatCurrency } from "@/lib/reference-data";
import { translateUiMessage, uiLabel } from "@/lib/ui-copy";

type Params = Promise<{ id: string }>;
export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: order }, { data: items }, { data: logs }, { data: anomaly }] = await Promise.all([
    supabase.from("orders").select("*,pharmacies(legal_name,trade_name,city),brand_pharmacies(id)").eq("id", id).eq("brand_id", brand.id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
    supabase.from("activity_logs").select("id,action,created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("order_anomalies").select("*").eq("order_id", id).maybeSingle(),
  ]);
  if (!order) notFound();
  const pharmacy = Array.isArray(order.pharmacies) ? order.pharmacies[0] : order.pharmacies;
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold">{order.order_number || order.external_order_id || `Commande ${order.id.slice(0,8)}`}</h1><p className="text-muted-foreground">{pharmacy?.trade_name || pharmacy?.legal_name} · {new Date(order.order_date).toLocaleString("fr-FR")}</p></div><Button asChild variant="outline"><Link href={`/dashboard/pharmacies/${order.brand_pharmacy_id}?tab=orders`}>Voir la pharmacie</Link></Button></div>{anomaly ? <Card className="border-destructive"><CardContent className="pt-5 text-destructive">{translateUiMessage(anomaly.description)}</CardContent></Card> : null}
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="space-y-6"><Card><CardHeader><CardTitle>Lignes figées</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>Qté</TableHead><TableHead>Gratuits</TableHead><TableHead>Prix HT</TableHead><TableHead>Remise</TableHead><TableHead>Total HT</TableHead></TableRow></TableHeader><TableBody>{(items ?? []).map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.product_name_snapshot}</p><p className="text-xs text-muted-foreground">{item.sku_snapshot}</p></TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.free_quantity}</TableCell><TableCell>{formatCurrency(item.unit_price_ht)}</TableCell><TableCell>{formatCurrency(item.discount_amount_ht)}</TableCell><TableCell>{formatCurrency(item.line_total_ht)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card><Card><CardHeader><CardTitle>Historique</CardTitle></CardHeader><CardContent className="space-y-2">{(logs ?? []).map((log) => <div key={log.id} className="flex justify-between border-b pb-2 text-sm"><span>{uiLabel(log.action)}</span><time>{new Date(log.created_at).toLocaleString("fr-FR")}</time></div>)}</CardContent></Card></div>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Statut</CardTitle></CardHeader><CardContent><OrderStatusForm orderId={order.id} currentStatus={order.order_status} /></CardContent></Card><Card><CardHeader><CardTitle>Montants</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p className="flex justify-between"><span>Sous-total HT</span><strong>{formatCurrency(order.subtotal_ht)}</strong></p><p className="flex justify-between"><span>Remises</span><strong>{formatCurrency(order.discount_amount_ht)}</strong></p><p className="flex justify-between"><span>Net HT</span><strong>{formatCurrency(order.net_amount_ht)}</strong></p><p className="flex justify-between"><span>Taxes</span><strong>{formatCurrency(order.tax_amount)}</strong></p><p className="flex justify-between text-base"><span>Total TTC</span><strong>{formatCurrency(order.total_ttc)}</strong></p><Badge>{order.is_initial_order ? "Implantation" : order.is_reorder ? "Réassort" : uiLabel(order.order_type)}</Badge></CardContent></Card></div></div>
  </div>;
}
