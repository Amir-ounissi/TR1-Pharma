"use client";

import { useActionState, useState } from "react";
import { changeOrderStatusAction, createOrderAction, searchOrderPharmaciesAction, type OrderPharmacySearchResult } from "@/app/(protected)/dashboard/orders/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uiLabel } from "@/lib/ui-copy";

type Option = { id: string; name: string; detail?: string; price?: number | null; taxRate?: number | null; unitsPerCase?: number | null; minimumOrderQuantity?: number | null };

function PharmacyAutocomplete({ initialPharmacy }: { initialPharmacy?: OrderPharmacySearchResult }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderPharmacySearchResult[]>([]);
  const [selected, setSelected] = useState<OrderPharmacySearchResult | undefined>(initialPharmacy);
  const [loading, setLoading] = useState(false);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try { setResults(await searchOrderPharmaciesAction(value)); } finally { setLoading(false); }
  }

  return <div className="space-y-2 sm:col-span-2 lg:col-span-3">
    <Label htmlFor="pharmacy-search">Pharmacie</Label>
    <Input id="pharmacy-search" value={selected ? selected.name : query} placeholder="Rechercher une pharmacie : nom, ville, CIP, SIRET…" autoComplete="off" onChange={(event) => { setSelected(undefined); void search(event.target.value); }} />
    <input type="hidden" name="brandPharmacyId" value={selected?.brandPharmacyId ?? ""} />
    <input type="hidden" name="pharmacyId" value={selected?.brandPharmacyId ? "" : selected?.pharmacyId ?? ""} />
    {selected ? <p className="text-xs text-muted-foreground">{selected.detail} · {selected.relationStatus === "existing_brand_relation" ? "Déjà cliente" : "Nouvelle pour la marque : rattachement à la confirmation"}</p> : null}
    {!selected && results.length > 0 ? <div className="max-h-56 overflow-auto rounded-md border bg-popover p-1 shadow-sm">{results.map((result) => <button key={result.pharmacyId} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" type="button" onClick={() => { setSelected(result); setResults([]); }}><span className="font-medium">{result.name}</span><span className="block text-xs text-muted-foreground">{result.detail} · {result.relationStatus === "existing_brand_relation" ? "Déjà cliente" : "Nouvelle pour la marque"}</span></button>)}</div> : null}
    {loading ? <p className="text-xs text-muted-foreground">Recherche…</p> : null}
  </div>;
}

export function OrderForm({ products, initialPharmacy, isAgent = false }: { products: Option[]; initialPharmacy?: OrderPharmacySearchResult; isAgent?: boolean }) {
  const [state, action, pending] = useActionState(createOrderAction, {});
  const [lines, setLines] = useState(["line-1"]);
  const [selectedProducts, setSelectedProducts] = useState<Record<number, string>>({});
  const [unitPrices, setUnitPrices] = useState<Record<number, string>>({});
  const orderStatuses = isAgent ? ["draft", "pending", "confirmed"] : ["draft", "pending", "confirmed", "invoiced", "partially_delivered", "delivered"];
  return <form action={action} className="space-y-6"><ActionFeedback {...state} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <PharmacyAutocomplete initialPharmacy={initialPharmacy} />
      <div className="space-y-2"><Label htmlFor="orderDate">Date de commande</Label><Input id="orderDate" name="orderDate" type="datetime-local" required /></div>
      <div className="space-y-2"><Label htmlFor="orderStatus">Statut</Label><Select name="orderStatus" defaultValue={isAgent ? "confirmed" : "draft"}><SelectTrigger id="orderStatus" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{orderStatuses.map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="orderType">Type demandé</Label><Select name="orderType" defaultValue="other"><SelectTrigger id="orderType" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["initial","reorder","complementary","replacement","sample","return","credit_note","other"].map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="externalOrderId">Référence externe</Label><Input id="externalOrderId" name="externalOrderId" /></div>
      <div className="space-y-2"><Label htmlFor="orderNumber">Numéro de commande</Label><Input id="orderNumber" name="orderNumber" /></div>
      <div className="space-y-2"><Label htmlFor="shippingAmountHt">Port HT</Label><Input id="shippingAmountHt" name="shippingAmountHt" type="number" min="0" step="0.01" defaultValue="0" required /></div>
      <div className="space-y-2"><Label htmlFor="paymentStatus">Paiement</Label><Select name="paymentStatus" defaultValue="pending"><SelectTrigger id="paymentStatus" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["not_applicable","pending","partially_paid","paid","overdue","refunded"].map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label htmlFor="orderNotes">Notes</Label><Textarea id="orderNotes" name="notes" /></div>
    </div>
    <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-medium">Lignes</h2><Button type="button" variant="outline" onClick={() => setLines((current) => [...current, crypto.randomUUID()])}>Ajouter une ligne</Button></div>{lines.map((lineId, index) => { const product = products.find((item) => item.id === selectedProducts[index]); return <div key={lineId} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-6"><div className="space-y-2 lg:col-span-2"><Label htmlFor={`productId-${index}`}>Produit</Label><Select name="productId" required onValueChange={(value) => { const selected = products.find((item) => item.id === value); setSelectedProducts((current) => ({ ...current, [index]: value })); setUnitPrices((current) => ({ ...current, [index]: selected?.price == null ? current[index] ?? "" : String(selected.price) })); }}><SelectTrigger id={`productId-${index}`} className="w-full"><SelectValue placeholder="Produit" /></SelectTrigger><SelectContent>{products.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.detail}</SelectItem>)}</SelectContent></Select>{product ? <p className="text-xs text-muted-foreground">TVA {product.taxRate ?? 0}% · Colisage {product.unitsPerCase ?? "—"} · Minimum {product.minimumOrderQuantity ?? "—"}</p> : null}</div><div><Label htmlFor={`quantity-${index}`}>Quantité</Label><Input id={`quantity-${index}`} name="quantity" type="number" min="1" defaultValue="1" required /></div><div><Label htmlFor={`freeQuantity-${index}`}>Gratuits</Label><Input id={`freeQuantity-${index}`} name="freeQuantity" type="number" min="0" defaultValue="0" /></div><div><Label htmlFor={`unitPriceHt-${index}`}>Prix unitaire HT</Label><Input id={`unitPriceHt-${index}`} name="unitPriceHt" type="number" step="0.01" value={unitPrices[index] ?? ""} onChange={(event) => setUnitPrices((current) => ({ ...current, [index]: event.target.value }))} required /></div><div><Label htmlFor={`discountRate-${index}`}>Remise %</Label><Input id={`discountRate-${index}`} name="discountRate" type="number" min="0" max="100" step="0.01" /></div>{lines.length > 1 ? <Button type="button" variant="ghost" className="sm:col-span-2 lg:col-span-6" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Retirer la ligne</Button> : null}</div>; })}</div>
    <Button disabled={pending}>{pending ? "Création…" : "Créer la commande"}</Button>
  </form>;
}

export function OrderStatusForm({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(changeOrderStatusAction, {});
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><ActionFeedback {...state} /><div className="space-y-2"><Label>Statut</Label><Select name="orderStatus" defaultValue={currentStatus}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["draft","pending","confirmed","invoiced","partially_delivered","delivered","cancelled","refunded"].map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Motif d’annulation ou correction</Label><Input name="reason" /></div><Button disabled={pending} className="w-full">Mettre à jour</Button></form>;
}
