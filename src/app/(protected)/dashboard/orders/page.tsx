import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCurrency } from "@/lib/reference-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const pageSize = 25;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const isAgent = contexts.find((context) => context.id === brand.id)?.role === "agent";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  let query = supabase.from("orders").select("*,pharmacies(legal_name,trade_name,city)", { count: "exact" }).eq("brand_id", brand.id).is("archived_at", null).order("order_date", { ascending: false });
  if (typeof params.status === "string" && params.status !== "all") query = query.eq("order_status", params.status);
  if (typeof params.type === "string" && params.type !== "all") query = query.eq("order_type", params.type);
  if (typeof params.source === "string" && params.source !== "all") query = query.eq("source", params.source);
  if (typeof params.payment === "string" && params.payment !== "all") query = query.eq("payment_status", params.payment);
  if (typeof params.from === "string" && params.from) query = query.gte("order_date", params.from);
  if (typeof params.to === "string" && params.to) query = query.lte("order_date", `${params.to}T23:59:59`);
  if (params.classification === "initial") query = query.eq("is_initial_order", true);
  if (params.classification === "reorder") query = query.eq("is_reorder", true);
  const { data: orders, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold">Commandes</h1><p className="text-muted-foreground">Commandes, implantations, réassorts et avoirs de {brand.name}.</p></div><div className="flex gap-2">{!isAgent ? <Button asChild variant="outline"><Link href="/dashboard/imports">Importer un CSV</Link></Button> : null}<Button asChild><Link href="/dashboard/orders/new">Nouvelle commande</Link></Button></div></div>
    <Card><CardContent className="pt-6"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"><Select name="status" defaultValue={typeof params.status === "string" ? params.status : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem>{["draft","pending","confirmed","invoiced","partially_delivered","delivered","cancelled","refunded"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select name="type" defaultValue={typeof params.type === "string" ? params.type : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous types</SelectItem>{["initial","reorder","complementary","replacement","sample","return","credit_note","other"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select name="source" defaultValue={typeof params.source === "string" ? params.source : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes sources</SelectItem>{["manual","agent","brand","import","api","erp","system"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select name="payment" defaultValue={typeof params.payment === "string" ? params.payment : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous paiements</SelectItem>{["not_applicable","pending","partially_paid","paid","overdue","refunded"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select name="classification" defaultValue={typeof params.classification === "string" ? params.classification : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Implantation + réassort</SelectItem><SelectItem value="initial">Implantations</SelectItem><SelectItem value="reorder">Réassorts</SelectItem></SelectContent></Select><Input name="from" type="date" defaultValue={typeof params.from === "string" ? params.from : ""} /><Input name="to" type="date" defaultValue={typeof params.to === "string" ? params.to : ""} /><Button>Filtrer</Button></form></CardContent></Card>
    <Card><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Chargement impossible.</p> : <Table><TableHeader><TableRow><TableHead>Commande</TableHead><TableHead>Pharmacie</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead><TableHead>Net HT</TableHead><TableHead>Paiement</TableHead></TableRow></TableHeader><TableBody>{(orders ?? []).map((order) => { const pharmacy = Array.isArray(order.pharmacies) ? order.pharmacies[0] : order.pharmacies; return <TableRow key={order.id}><TableCell><Link href={`/dashboard/orders/${order.id}`} className="font-medium hover:underline">{order.order_number || order.external_order_id || order.id.slice(0, 8)}</Link></TableCell><TableCell>{pharmacy?.trade_name || pharmacy?.legal_name}<p className="text-xs text-muted-foreground">{pharmacy?.city}</p></TableCell><TableCell>{new Date(order.order_date).toLocaleDateString("fr-FR")}</TableCell><TableCell>{order.is_initial_order ? "implantation" : order.is_reorder ? "réassort" : order.order_type}</TableCell><TableCell><Badge variant="secondary">{order.order_status}</Badge></TableCell><TableCell>{formatCurrency(order.net_amount_ht)}</TableCell><TableCell>{order.payment_status}</TableCell></TableRow>; })}</TableBody></Table>}</CardContent></Card>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{count ?? 0} commande(s)</p><div className="flex gap-2"><Button asChild variant="outline" disabled={page <= 1}><Link href={`?page=${Math.max(1,page-1)}`}>Précédent</Link></Button><span className="self-center text-sm">{page}/{totalPages}</span><Button asChild variant="outline" disabled={page >= totalPages}><Link href={`?page=${Math.min(totalPages,page+1)}`}>Suivant</Link></Button></div></div>
  </div>;
}
