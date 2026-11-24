import Link from "next/link";
import { requireVitaloraDemo } from "@/lib/vitalora-demo";
import {checkoutDemoAction,removeDemoCartItemAction,setDemoCartItemAction} from "../actions";
export default async function DemoBasket({searchParams}:{searchParams:Promise<{ajoute?:string,retire?:string,erreur?:string}>}) {
  const {db,pharmacyId}=await requireVitaloraDemo();
  const query=await searchParams;
  if(!pharmacyId)return <section className="rounded-xl border bg-white p-8">
    <h1 className="text-2xl font-bold">Panier non accessible</h1>
    <Link href="/catalogue/demo" className="mt-4 inline-block underline">Retour au catalogue test</Link>
  </section>;
  const result=await db.from("demo_cart_items").select("product_id,quantity")
    .eq("pharmacy_id",pharmacyId);
  if(result.error)throw new Error("Panier de démonstration indisponible.");
  const cart=result.data??[];
  const ids=cart.map(x=>x.product_id);
  const [products,tiers]=await Promise.all([
    ids.length?db.from("demo_products")
      .select("id,name,sku,format,image_url,demo_price_ht,min_qty,qty_step").in("id",ids)
      : Promise.resolve({data:[],error:null}),
    ids.length?db.from("demo_price_tiers").select("product_id,min_qty,price_ht").in("product_id",ids)
      : Promise.resolve({data:[],error:null}),
  ]);
  if(products.error||tiers.error)throw new Error("Tarifs de démonstration indisponibles.");
  const byId=new Map((products.data||[]).map(x=>[x.id,x]));
  const lines=cart.flatMap(c=>{
    const p=byId.get(c.product_id);
    if(!p)return [];
    const rate=(tiers.data||[]).filter(t=>t.product_id===p.id&&t.min_qty<=c.quantity)
      .sort((a,b)=>b.min_qty-a.min_qty)[0];
    const unit=Number(rate?.price_ht??p.demo_price_ht);
    return [{...p,quantity:c.quantity,unit,total:Math.round(c.quantity*unit*100)/100}];
  });
  const total=lines.reduce((sum,x)=>sum+x.total,0);
  return <div className="space-y-6">
    <Link href="/catalogue/demo" className="text-sm font-bold underline">← Catalogue Vitalora test</Link>
    <div className="rounded-xl border border-[#e4c89f] bg-[#fff8ec] p-5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#995219]">Démonstration sans commande réelle</p>
      <h1 className="mt-2 text-3xl font-bold">Panier test Vitalora</h1>
      <p className="mt-2 text-sm">Prix et montants fictifs. La validation ne transmet aucun bon de commande à Vitalora.</p>
    </div>
    {query.ajoute==="1"?<p role="status" className="rounded-lg bg-green-50 p-4 text-sm font-bold text-green-800">Produit ajouté au panier test.</p>:null}
    {query.retire==="1"?<p role="status" className="rounded-lg bg-green-50 p-4 text-sm font-bold text-green-800">Produit retiré du panier test.</p>:null}
    {query.erreur?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Une quantité ou un tarif de démonstration est invalide. Vérifie les lignes avant de réessayer.</p>:null}
    {lines.length?<section className="overflow-hidden rounded-xl border bg-white">
      {lines.map(x=><div key={x.id} className="flex flex-wrap gap-4 border-b p-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-[#faf9f7]">
          {x.image_url?<img src={x.image_url} alt={x.name} className="h-full max-w-full object-contain"/>:null}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{x.name}</h2>
          <p className="mt-1 text-xs text-[#69717d]">{x.format||x.sku} · {x.sku}</p>
          <p className="mt-2 text-sm"><strong>{x.unit.toFixed(2)} € HT</strong> / unité (fictif)</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <form action={setDemoCartItemAction} className="flex items-end gap-2">
              <input type="hidden" name="product_id" value={x.id}/>
              <label className="grid gap-1 text-xs font-semibold">Unités
                <input name="quantity" type="number" min={x.min_qty} step={x.qty_step} max="500"
                  defaultValue={x.quantity} required className="w-20 rounded-lg border p-2"/></label>
              <button className="rounded-lg border px-3 py-2 text-xs font-bold">Actualiser</button>
            </form>
            <form action={removeDemoCartItemAction}>
              <input type="hidden" name="product_id" value={x.id}/>
              <button className="rounded-lg border px-3 py-2 text-xs text-[#ad4b08]">Retirer</button>
            </form>
          </div>
        </div>
        <p className="text-lg font-extrabold">{x.total.toFixed(2)} €</p>
      </div>)}
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-[#69717d]">Total simulé hors taxes</p>
            <p className="text-3xl font-extrabold">{total.toFixed(2)} € HT</p></div>
          <form action={checkoutDemoAction}>
            <button className="rounded-lg bg-[#142941] px-6 py-4 text-sm font-bold text-white">
              Valider une demande fictive
            </button>
          </form>
        </div>
        <p className="text-xs leading-5 text-[#995219]">
          Confirmation de test uniquement : aucune vente, aucun paiement, aucune facture,
          aucun stock réservé, aucun email ou bon de commande envoyé au fournisseur.
        </p>
      </div>
    </section>:<section className="rounded-xl border bg-white p-8">
      <h2 className="text-xl font-bold">Ton panier test est vide</h2>
      <Link href="/catalogue/demo" className="mt-4 inline-block rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Ajouter des produits Vitalora</Link>
    </section>}
    <Link href="/catalogue/demo/demandes" className="inline-block text-sm font-bold underline">Historique des demandes de démonstration</Link>
  </div>;
}
