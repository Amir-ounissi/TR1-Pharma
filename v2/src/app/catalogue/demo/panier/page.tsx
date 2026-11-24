import Link from "next/link";
import { ArrowLeft, ShoppingBag, ShieldCheck, Truck, Trash2, Package } from "lucide-react";
import { requireVitaloraDemo } from "@/lib/vitalora-demo";
import { demoMoney, unitPriceForDemo } from "@/lib/demo-display";
import { checkoutDemoAction, removeDemoCartItemAction, setDemoCartItemAction } from "../actions";

export default async function DemoBasket({searchParams}:{searchParams:Promise<{ajoute?:string,retire?:string,erreur?:string}>}) {
  const {db,pharmacyId}=await requireVitaloraDemo();
  const q=await searchParams;
  if(!pharmacyId)return <section className="rounded-xl border bg-white p-8">
    <h1 className="text-2xl font-bold">Panier test non accessible</h1>
    <Link href="/catalogue/demo" className="mt-4 inline-block underline">Retour au catalogue</Link>
  </section>;
  const result=await db.from("demo_cart_items").select("product_id,quantity").eq("pharmacy_id",pharmacyId);
  if(result.error)throw new Error("Panier de démonstration indisponible.");
  const cart=result.data??[],ids=cart.map(x=>x.product_id);
  const [products,tiers]=await Promise.all([
    ids.length?db.from("demo_products")
      .select("id,name,sku,format,image_url,demo_price_ht,min_qty,qty_step")
      .in("id",ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from("demo_price_tiers").select("product_id,min_qty,price_ht")
      .in("product_id",ids):Promise.resolve({data:[],error:null}),
  ]);
  if(products.error||tiers.error)throw new Error("Tarifs de démonstration indisponibles.");
  const byId=new Map((products.data??[]).map(x=>[x.id,x]));
  const lines=cart.flatMap(c=>{
    const p=byId.get(c.product_id);
    if(!p)return [];
    const rate=unitPriceForDemo(p.demo_price_ht,
      (tiers.data??[]).filter(t=>t.product_id===p.id),c.quantity);
    return [{...p,quantity:c.quantity,unit:rate,total:Math.round(c.quantity*rate*100)/100}];
  });
  const total=lines.reduce((sum,x)=>sum+x.total,0);
  const pieces=lines.reduce((sum,x)=>sum+x.quantity,0);

  return <div className="space-y-6 pb-12">
    <nav aria-label="Fil d'Ariane" className="text-xs text-[#6a7985]">
      <Link href="/catalogue/demo" className="hover:underline">Vitalora test</Link>
      <span className="mx-2">/</span><strong className="text-[#142941]">Panier simulé</strong>
    </nav>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a5a2b]">ESPACE OFFICINE · MODE TEST</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[#142941]">Votre panier Vitalora</h1>
        <p className="mt-2 text-sm text-[#687986]">{lines.length} référence(s) · {pieces} unité(s) · montants fictifs HT</p>
      </div>
      <Link href="/catalogue/demo" className="inline-flex items-center gap-2 rounded-lg border border-[#d7e0e5] bg-white px-4 py-3 text-sm font-semibold text-[#142941] hover:bg-[#f4f7f8]"><ArrowLeft size={15}/> Poursuivre la sélection</Link>
    </header>
    <div className="rounded-xl border border-[#ebdfca] bg-[#fff9ed] px-5 py-4 text-sm text-[#855124]">
      <p className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0"/>
        <span><strong>Démonstration uniquement.</strong> Aucune commande, facture, réservation de stock ou transmission à Vitalora.</span>
      </p>
    </div>
    {q.ajoute==="1" && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Référence ajoutée au panier test.</p>}
    {q.retire==="1" && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Référence retirée du panier.</p>}
    {q.erreur && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Une ligne ne respecte pas les quantités autorisées. Corrige le panier puis réessaie.</p>}
    {lines.length ? <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="overflow-hidden rounded-xl border border-[#e1e7e9] bg-white">
        <div className="border-b border-[#e6ebee] bg-[#f9fafb] px-5 py-4"><h2 className="text-sm font-bold text-[#142941]">Récapitulatif des produits</h2></div>
        {lines.map(x=><article key={x.id} className="flex flex-wrap gap-4 border-b border-[#edf0f1] p-5 last:border-0">
          <Link href={`/catalogue/demo/produit/${x.id}`} className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg bg-[#f7f8f8] p-2">
            {x.image_url?<img src={x.image_url} alt={x.name} className="h-full max-w-full object-contain"/>:
              <Package size={28} className="text-[#8b99a3]"/>}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/catalogue/demo/produit/${x.id}`} className="text-sm font-bold text-[#142941] hover:underline">{x.name}</Link>
            <p className="mt-1 text-xs text-[#788793]">{x.format||x.sku} · {x.sku}</p>
            <p className="mt-2 text-xs text-[#697782]">Prix HT / unité simulé : <strong>{demoMoney(x.unit)}</strong></p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <form action={setDemoCartItemAction} className="flex items-end gap-2">
                <input type="hidden" name="product_id" value={x.id}/>
                <label className="grid gap-1 text-xs font-semibold text-[#5e7080]">Quantité
                  <input name="quantity" type="number" min={x.min_qty} step={x.qty_step} max="500"
                    defaultValue={x.quantity} required
                    className="w-20 rounded-lg border border-[#d7dfe4] bg-white px-2 py-2 text-center text-sm text-[#142941]"/></label>
                <button className="rounded-lg border border-[#d7dfe4] px-3 py-2 text-xs font-semibold text-[#142941] hover:bg-[#f7f8f8]">Actualiser</button>
              </form>
              <form action={removeDemoCartItemAction}>
                <input type="hidden" name="product_id" value={x.id}/>
                <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-[#ad4b08] hover:bg-[#fff7f1]">
                  <Trash2 size={13} aria-hidden="true"/> Supprimer
                </button>
              </form>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] text-[#7a8994]">Total ligne HT fictif</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-[#142941]">{demoMoney(x.total)}</p>
          </div>
        </article>)}
      </section>
      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="rounded-xl border border-[#d8e2e7] bg-white p-5 shadow-[0_5px_24px_rgb(14_29_49/0.06)]">
          <h2 className="text-base font-bold text-[#142941]">Synthèse de la simulation</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-[#677885]">Références</span><strong>{lines.length}</strong></div>
            <div className="flex justify-between"><span className="text-[#677885]">Unités</span><strong>{pieces}</strong></div>
            <div className="flex justify-between"><span className="text-[#677885]">Prix TTC / marge</span><strong className="text-xs">Non renseignés</strong></div>
            <div className="flex justify-between"><span className="text-[#677885]">Livraison</span><strong className="text-xs">Non applicable au test</strong></div>
          </div>
          <div className="my-4 border-t border-[#e2e8eb]"/>
          <p className="text-xs text-[#6c7c87]">Total fictif hors taxes</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#142941]">{demoMoney(total)}</p>
          <form action={checkoutDemoAction} className="mt-5">
            <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white hover:bg-[#26425b]">
              <ShoppingBag size={16} aria-hidden="true"/> Valider la simulation
            </button>
          </form>
          <p className="mt-3 text-[11px] leading-5 text-[#72808b]">Confirmation fictive uniquement. Aucun email ou bon de commande fournisseur n'est généré.</p>
        </section>
        <div className="rounded-xl border border-[#e1e7e9] bg-[#f9fafb] p-5 text-xs leading-5 text-[#70808c]">
          <Truck size={18} className="mb-2" aria-hidden="true"/>
          <p><strong>Logistique réelle :</strong> stock, délai et franco non communiqués. Ces données seront ajoutées au catalogue commercial après vérification.</p>
        </div>
      </aside>
    </div>:<section className="rounded-xl border border-[#e1e7e9] bg-white px-6 py-14 text-center">
      <ShoppingBag size={34} className="mx-auto text-[#9baab4]" aria-hidden="true"/>
      <h2 className="mt-4 text-xl font-bold text-[#142941]">Le panier est vide</h2>
      <p className="mt-2 text-sm text-[#70808c]">Ajoute quelques références Vitalora pour simuler une demande de référencement.</p>
      <Link href="/catalogue/demo" className="mt-5 inline-block rounded-lg bg-[#142941] px-5 py-3 text-sm font-semibold text-white">Explorer les produits</Link>
    </section>}
    <Link href="/catalogue/demo/demandes" className="inline-block text-sm font-semibold text-[#1a4e70] underline underline-offset-2">Consulter les simulations précédentes</Link>
  </div>;
}
