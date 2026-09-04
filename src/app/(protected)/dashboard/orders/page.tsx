import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCurrency } from "@/lib/reference-data";
import { orderStatusLabel, uiLabel } from "@/lib/ui-copy";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const pageSize = 25;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, brand, userId } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const isAgent = contexts.find((context) => context.id === brand.id)?.role === "agent";
  const { data: workflowSummary } = await supabase.rpc("get_order_workflow_summary", {
    target_brand_id: brand.id,
    target_period_start: null,
    target_period_end: null,
    target_agent_id: isAgent ? userId : null,
  });
  const workflow = (workflowSummary ?? {}) as Record<string, number>;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  let query = supabase.from("orders").select("*,pharmacies(legal_name,trade_name,city)", { count: "exact" }).eq("brand_id", brand.id).is("archived_at", null).order("order_date", { ascending: false });
  if (isAgent) query = query.or(`created_by.eq.${userId},source_agent_user_id.eq.${userId}`);
  if (typeof params.status === "string" && params.status !== "all") query = query.eq("order_status", params.status);
  if (typeof params.type === "string" && params.type !== "all") query = query.eq("order_type", params.type);
  if (typeof params.source === "string" && params.source !== "all") query = query.eq("source", params.source);
  if (typeof params.from === "string" && params.from) query = query.gte("order_date", params.from);
  if (typeof params.to === "string" && params.to) query = query.lte("order_date", `${params.to}T23:59:59`);
  if (params.classification === "initial") query = query.eq("is_initial_order", true);
  if (params.classification === "reorder") query = query.eq("is_reorder", true);
  const { data: orders, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold">{isAgent ? "Mes commandes" : "Commandes"}</h1><p className="text-muted-foreground">{isAgent ? "Suivez les commandes envoyées à la marque et les éventuelles corrections demandées." : `Validez les commandes terrain puis suivez leur facturation et leur livraison pour ${brand.name}.`}</p></div><div className="flex gap-2">{!isAgent ? <Button asChild variant="outline"><Link href="/dashboard/imports">Importer un CSV</Link></Button> : null}<Button asChild><Link href="/dashboard/orders/new">Nouvelle commande</Link></Button></div></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{workflow.pending_count ?? 0}</p><p className="text-sm font-medium">{isAgent ? "En attente marque" : "À valider"}</p><p className="text-xs text-muted-foreground">{formatCurrency(workflow.pending_revenue_ht ?? 0)} HT en attente</p></CardContent></Card>
      <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{workflow.needs_correction_count ?? 0}</p><p className="text-sm font-medium">À corriger</p><p className="text-xs text-muted-foreground">Retour nécessaire vers l’agent</p></CardContent></Card>
      <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCurrency(workflow.booked_revenue_ht ?? 0)}</p><p className="text-sm font-medium">CA commandé HT</p><p className="text-xs text-muted-foreground">Commandes validées</p></CardContent></Card>
      <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCurrency(workflow.invoiced_revenue_ht ?? 0)}</p><p className="text-sm font-medium">CA facturé HT</p><p className="text-xs text-muted-foreground">Facturé ou livré</p></CardContent></Card>
      <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{workflow.rejected_count ?? 0}</p><p className="text-sm font-medium">Refusées</p><p className="text-xs text-muted-foreground">Avec motif de décision</p></CardContent></Card>
    </section>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant={params.status === "pending" ? "default" : "outline"}><Link href="?status=pending">{isAgent ? "En attente" : "À valider"}</Link></Button>
      <Button asChild variant={params.status === "needs_correction" ? "default" : "outline"}><Link href="?status=needs_correction">À corriger</Link></Button>
      <Button asChild variant={params.status === "confirmed" ? "default" : "outline"}><Link href="?status=confirmed">Validées</Link></Button>
      <Button asChild variant={params.status === "rejected" ? "default" : "outline"}><Link href="?status=rejected">Refusées</Link></Button>
      <Button asChild variant={!params.status || params.status === "all" ? "default" : "outline"}><Link href="/dashboard/orders">Toutes</Link></Button>
    </div>
    <Card><CardContent className="pt-6"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><Select name="status" defaultValue={typeof params.status === "string" ? params.status : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem>{["draft","pending","needs_correction","confirmed","invoiced","partially_delivered","delivered","rejected","cancelled","refunded"].map((value) => <SelectItem key={value} value={value}>{orderStatusLabel(value)}</SelectItem>)}</SelectContent></Select><Select name="type" defaultValue={typeof params.type === "string" ? params.type : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous types</SelectItem>{["initial","reorder","complementary","replacement","sample","return","credit_note","other"].map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select><Select name="source" defaultValue={typeof params.source === "string" ? params.source : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes sources</SelectItem>{["manual","agent","brand","import","api","erp","system"].map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select><Select name="classification" defaultValue={typeof params.classification === "string" ? params.classification : "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Implantation + réassort</SelectItem><SelectItem value="initial">Implantations</SelectItem><SelectItem value="reorder">Réassorts</SelectItem></SelectContent></Select><Input name="from" type="date" defaultValue={typeof params.from === "string" ? params.from : ""} /><Input name="to" type="date" defaultValue={typeof params.to === "string" ? params.to : ""} /><Button>Filtrer</Button></form></CardContent></Card>
    <Card><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Chargement impossible.</p> : <Table><TableHeader><TableRow><TableHead>Commande</TableHead><TableHead>Pharmacie</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead><TableHead>Net HT</TableHead>{!isAgent ? <TableHead>Règlement</TableHead> : null}</TableRow></TableHeader><TableBody>{(orders ?? []).map((order) => { const pharmacy = Array.isArray(order.pharmacies) ? order.pharmacies[0] : order.pharmacies; return <TableRow key={order.id}><TableCell><Link href={`/dashboard/orders/${order.id}`} className="font-medium hover:underline">{order.order_number || order.external_order_id || order.id.slice(0, 8)}</Link></TableCell><TableCell>{pharmacy?.trade_name || pharmacy?.legal_name}<p className="text-xs text-muted-foreground">{pharmacy?.city}</p></TableCell><TableCell>{new Date(order.order_date).toLocaleDateString("fr-FR")}</TableCell><TableCell>{order.is_initial_order ? "Implantation" : order.is_reorder ? "Réassort" : uiLabel(order.order_type)}</TableCell><TableCell><Badge variant="secondary">{orderStatusLabel(order.order_status)}</Badge></TableCell><TableCell>{formatCurrency(order.net_amount_ht)}</TableCell>{!isAgent ? <TableCell>{order.payment_status === "not_applicable" ? "Non connecté" : uiLabel(order.payment_status)}</TableCell> : null}</TableRow>; })}</TableBody></Table>}</CardContent></Card>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{count ?? 0} commande(s)</p><div className="flex gap-2"><Button asChild variant="outline" disabled={page <= 1}><Link href={`?page=${Math.max(1,page-1)}`}>Précédent</Link></Button><span className="self-center text-sm">{page}/{totalPages}</span><Button asChild variant="outline" disabled={page >= totalPages}><Link href={`?page=${Math.min(totalPages,page+1)}`}>Suivant</Link></Button></div></div>
  </div>;
}
