import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createProductAction, setProductPublishedAction } from "../actions";
export default async function ProductsPage() {
  const { db } = await requireOwner();
  const [b, p] = await Promise.all([
    db.from("brands").select("id,name").order("name"),
    db.from("products").select("id,name,sku,brand_id,price_ht,published").order("name").limit(100),
  ]);
  if (b.error || p.error) throw new Error("Impossible de charger les produits.");
  const brands = b.data ?? [];
  return <div className="space-y-6">
    <div><Link href="/app/marques" className="text-sm font-semibold underline">← Mes marques</Link>
      <h1 className="mt-3 text-3xl font-bold">Références produits</h1>
      <p className="mt-2 text-sm text-[#69717d]">Création en brouillon ; aucun produit n'est publié automatiquement.</p></div>
    <form action={createProductAction} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-3">
      <select name="brand_id" required className="rounded-lg border p-3">
        <option value="">Choisir une marque</option>
        {brands.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
      </select>
      <input name="sku" placeholder="SKU" required className="rounded-lg border p-3"/>
      <input name="name" placeholder="Nom du produit" required className="rounded-lg border p-3"/>
      <label className="text-xs">Prix HT (€)<input name="price_ht" type="number" step="0.01" min="0" required className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs">Minimum (unités)<input name="min_qty" type="number" defaultValue="6" min="1" required className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs">Pas (unités)<input name="qty_step" type="number" defaultValue="6" min="1" required className="mt-1 w-full rounded-lg border p-3"/></label>
      <button disabled={!brands.length} className="rounded-lg bg-[#142941] px-4 py-3 font-semibold text-white disabled:opacity-40">Créer en brouillon</button>
    </form>
    <div className="overflow-hidden rounded-xl border bg-white">
      {(p.data ?? []).length ? p.data?.map(x=><div key={x.id} className="flex flex-wrap justify-between gap-3 border-b px-5 py-4">
        <div><strong>{x.name}</strong><p className="text-xs text-[#69717d]">{brands.find(b=>b.id===x.brand_id)?.name} · {x.sku}</p></div>
        <form action={setProductPublishedAction} className="flex items-center gap-3">
          <span className="text-sm">{Number(x.price_ht).toFixed(2)} € HT · {x.published ? "Publié" : "Brouillon"}</span>
          <input type="hidden" name="product_id" value={x.id}/>
          <input type="hidden" name="published" value={x.published ? "false" : "true"}/>
          <button className="rounded-lg border px-3 py-2 text-xs font-semibold">{x.published ? "Masquer" : "Publier"}</button>
        </form>
      </div>) : <p className="p-6 text-sm text-[#69717d]">Aucun produit créé.</p>}
    </div>
  </div>;
}
