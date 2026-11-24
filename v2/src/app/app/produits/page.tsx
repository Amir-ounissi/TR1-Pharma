import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createProductAction, setProductPublishedAction } from "../actions";
export default async function ProductsPage({searchParams}:{searchParams:Promise<{marque?:string,statut?:string,q?:string}>}) {
  const { db } = await requireOwner();
  const filters=await searchParams;
  const [b,p,stopped]=await Promise.all([
    db.from("brands").select("id,name,active").order("name"),
    db.from("products").select("id,name,sku,ean,brand_id,price_ht,published,requires_review,price_verified,image_url,description,source_active,fr_market_checked,fr_label_checked,fr_market_document").order("name").limit(500),
    db.from("product_discontinuations").select("brand_id,ean,discontinued_on"),
  ]);
  if(b.error||p.error||stopped.error)throw new Error("Impossible de charger les produits.");
  const brands=b.data??[],all=p.data??[];
  const archived=new Set((stopped.data??[]).map(x=>x.brand_id+":"+x.ean));
  const isArchived=(x:{brand_id:string;ean:string|null})=>archived.has(x.brand_id+":"+x.ean);
  const active=all.filter(x=>!isArchived(x));
  const q=(filters.q||"").trim().toLocaleLowerCase("fr").slice(0,80);
  const shown=all.filter(x=>(filters.statut==="archives"?isArchived(x):!isArchived(x))&&
    (!filters.marque||x.brand_id===filters.marque)&&
    (!q||x.name.toLocaleLowerCase("fr").includes(q)||x.sku.toLocaleLowerCase("fr").includes(q)||x.ean?.includes(q))&&
    (!filters.statut||
      (filters.statut==="publies"&&x.published)||
      (filters.statut==="a-verifier"&&(x.requires_review||!x.price_verified))||
      (filters.statut==="brouillons"&&!x.published)||
      (filters.statut==="archives"&&isArchived(x)))
  );
  const pending=active.filter(x=>x.requires_review||!x.price_verified).length;
  return <div className="space-y-6">
    <div>
      <Link href="/app/marques" className="text-sm font-semibold underline">← Mes marques</Link>
      <h1 className="mt-3 text-3xl font-bold">Catalogue produits</h1>
      <p className="mt-2 text-sm text-[#69717d]">{active.length} références au catalogue · {archived.size} archivées · {pending} à vérifier · {active.filter(x=>x.published).length} publiées.</p>
    </div>
    <form method="GET" className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_1fr_2fr_auto]">
      <select name="marque" defaultValue={filters.marque||""} className="rounded-lg border p-3 text-sm">
        <option value="">Toutes les marques</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select name="statut" defaultValue={filters.statut||""} className="rounded-lg border p-3 text-sm">
        <option value="">Tous les statuts</option><option value="a-verifier">À vérifier</option><option value="brouillons">Brouillons</option><option value="publies">Publiés</option><option value="archives">Archives / arrêtées</option>
      </select>
      <input name="q" defaultValue={q} placeholder="Rechercher par nom, SKU ou EAN" className="rounded-lg border p-3 text-sm"/>
      <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Filtrer</button>
    </form>
    <div className="overflow-hidden rounded-xl border bg-white">
      {shown.length ? shown.map(x=>{
        const ready=!x.requires_review&&x.price_verified&&!!x.ean&&!!x.image_url&&(x.description||"").trim().length>=10
          &&x.fr_market_checked&&x.fr_label_checked&&(x.fr_market_document||"").trim().length>=6;
        return <div key={x.id} className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            {isArchived(x)?<p className="mb-1 text-xs font-bold text-[#a25233]">Référence arrêtée — archivée / hors catalogue</p>:null}
            <Link href={"/app/produits/"+x.id} className="font-semibold underline-offset-4 hover:underline">{x.name}</Link>
            <p className="mt-1 break-all text-xs text-[#69717d]">{brands.find(b=>b.id===x.brand_id)?.name} · {x.sku} · {x.ean||"EAN manquant"}</p>
            <p className="mt-1 text-xs text-[#69717d]">{!x.image_url?"Visuel manquant · ":""}{!x.description?"Description manquante · ":""}{x.requires_review?"Fiche à vérifier":"Fiche vérifiée"} · {x.fr_market_checked&&x.fr_label_checked?"Conformité vérifiée":"Conformité France à vérifier"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap text-sm">{Number(x.price_ht).toFixed(2)} € HT</span>
            <Link className="rounded-lg border px-3 py-2 text-xs font-semibold" href={"/app/produits/"+x.id}>Vérifier / modifier</Link>
            <form action={setProductPublishedAction}>
              <input type="hidden" name="product_id" value={x.id}/>
              <input type="hidden" name="published" value={x.published?"false":"true"}/>
              <button disabled={isArchived(x)||(!ready&&!x.published)} className="rounded-lg border border-[#142941] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:border-[#ccd2d6] disabled:text-[#9aa0a7]">{x.published?"Retirer":"Publier"}</button>
            </form>
          </div>
        </div>;
      }):<p className="p-6 text-sm text-[#69717d]">Aucun résultat pour ce filtre.</p>}
    </div>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Ajouter un nouveau produit</h2>
      <p className="mt-1 text-xs text-[#69717d]">La fiche reste en brouillon tant qu'elle n'a pas été complétée et vérifiée.</p>
      <form action={createProductAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <select name="brand_id" required className="rounded-lg border p-3 text-sm">
          <option value="">Marque</option>{brands.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
        </select>
        <input name="sku" placeholder="SKU" required className="rounded-lg border p-3 text-sm"/>
        <input name="name" placeholder="Nom du produit" required className="rounded-lg border p-3 text-sm"/>
        <label className="text-xs">Prix HT (€)<input name="price_ht" type="number" step="0.01" min="0" required className="mt-1 w-full rounded-lg border p-3"/></label>
        <label className="text-xs">Minimum (unités)<input name="min_qty" type="number" defaultValue="6" min="1" required className="mt-1 w-full rounded-lg border p-3"/></label>
        <label className="text-xs">Pas (unités)<input name="qty_step" type="number" defaultValue="6" min="1" required className="mt-1 w-full rounded-lg border p-3"/></label>
        <button disabled={!brands.length} className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Créer en brouillon</button>
      </form>
    </section>
  </div>;
}
