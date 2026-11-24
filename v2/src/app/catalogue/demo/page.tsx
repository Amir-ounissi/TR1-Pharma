import Link from "next/link";
import {requireVitaloraDemo} from "@/lib/vitalora-demo";
import {setDemoCartItemAction} from "./actions";
export default async function VitaloraDemo({searchParams}:{searchParams:Promise<{erreur?:string}>}) {
  const {db,authorized,brandId}=await requireVitaloraDemo();
  const {erreur}=await searchParams;
  if(!authorized)return <section className="rounded-xl border bg-white p-8">
    <p className="text-xs font-bold uppercase tracking-widest text-[#a04b0d]">Espace de démonstration</p>
    <h1 className="mt-3 text-2xl font-bold">Accès non activé</h1>
    <p className="mt-3 text-sm text-[#69717d]">Ce pilote n'est accessible qu'aux comptes pharmacies explicitement autorisés.</p>
  </section>;
  const [p,t]=await Promise.all([
    db.from("demo_products").select("id,name,sku,ean,format,category,description,image_url,demo_price_ht,min_qty,qty_step")
      .eq("brand_id",brandId).eq("active",true).order("name"),
    db.from("demo_price_tiers").select("product_id,min_qty,price_ht").order("min_qty"),
  ]);
  if(p.error||t.error)throw new Error("Catalogue de démonstration indisponible.");
  const products=p.data||[],tiers=t.data||[];
  return <div className="space-y-7">
    <section className="rounded-xl border border-[#e4c89f] bg-[#fff8ec] p-5">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#9b4a0e]">Mode démonstration · Vitalora</p>
      <h1 className="mt-2 text-3xl font-extrabold">Catalogue Vitalora · TEST</h1>
      <p className="mt-3 text-sm leading-6">
        {products.length} produits issus du catalogue historique. Photos, noms et compositions à contrôler avant commercialisation.
        <strong> Tous les prix affichés sont fictifs et aucune demande n'est transmise à la marque.</strong>
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/catalogue/demo/panier" className="underline">Voir le panier test</Link>
        <Link href="/catalogue/demo/demandes" className="underline">Historique des demandes fictives</Link>
      </div>
    </section>
    {erreur?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      La quantité, l'accès ou les conditions du produit ne permettent pas cet ajout. Vérifie les multiples de 3.</p>:null}
    {products.length?<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map(x=>{
        const steps=tiers.filter(t=>t.product_id===x.id);
        return <article key={x.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="relative flex h-52 items-center justify-center bg-[#f8f8f6] p-5">
            {x.image_url?<img src={x.image_url} alt={x.name} loading="lazy"
              className="h-full max-w-full object-contain"/>:
              <span className="text-xs text-[#69717d]">Visuel non disponible</span>}
            <span className="absolute left-3 top-3 rounded-md bg-[#142941] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Démo</span>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#ad4b08]">{x.category||"Vitalora"}</p>
            <h2 className="min-h-12 text-lg font-bold">{x.name}</h2>
            <p className="text-xs text-[#69717d]">{x.format||"Format à vérifier"} · EAN {x.ean||"—"}</p>
            {x.description?<p className="line-clamp-3 min-h-14 text-sm text-[#69717d]">{x.description}</p>:null}
            <div className="rounded-lg bg-[#faf5eb] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#995219]">Prix fictif HT / unité</p>
              <p className="mt-1 text-2xl font-extrabold">{Number(x.demo_price_ht).toFixed(2)} €</p>
              <p className="mt-2 text-xs text-[#69717d]">
                {steps.map(t=>`${t.min_qty} u. : ${Number(t.price_ht).toFixed(2)} €`).join(" · ")}
              </p>
            </div>
          </div>
          <form action={setDemoCartItemAction} className="flex flex-wrap items-end gap-3 border-t p-4">
            <input type="hidden" name="product_id" value={x.id}/>
            <label className="grid gap-1 text-xs font-semibold">Quantité test
              <input name="quantity" type="number" min={x.min_qty} step={x.qty_step} max="500"
                defaultValue={x.min_qty} required className="w-24 rounded-lg border p-3 text-sm"/>
            </label>
            <button className="min-h-11 flex-1 rounded-lg bg-[#142941] px-4 py-3 text-xs font-bold text-white">Ajouter au panier test</button>
          </form>
        </article>;
      })}
    </div>:<p className="rounded-xl border bg-white p-6 text-sm">Aucun produit de démonstration n'est accessible.</p>}
    <p className="text-xs leading-5 text-[#69717d]">Ce catalogue est un environnement de test fermé. Informations produit issues du catalogue historique, non vérifiées pour une utilisation commerciale en France.</p>
  </div>;
}
