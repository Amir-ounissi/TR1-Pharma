import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { FileText, ShieldAlert, ImageOff, ArrowUpRight } from "lucide-react";

type Filters={marque?:string,q?:string,statut?:string};
export default async function AlthesiaQuality({searchParams}:{searchParams:Promise<Filters>}) {
  const {db}=await requireOwner();
  const f=await searchParams;
  const [brandsResult,productsResult,specsResult,offersResult,commResult,retiredResult]=await Promise.all([
    db.from("brands").select("id,name,slug,active").in("slug",["vitalora","bloomster","noto"]).order("name"),
    db.from("products").select("id,brand_id,sku,name,ean,image_url,published,requires_review,price_verified")
      .order("name").limit(200),
    db.from("althesia_product_specs").select("product_id,sub_brand,ingredients_and_doses,dosage_and_duration,market_status,source_document,source_page,source_summary,source_retail_ttc"),
    db.from("althesia_trade_offers").select("product_id,paid_quantity,price_confirmed").limit(300),
    db.from("brand_commission_settings").select("brand_id,rate_percent,review_status"),
    db.from("product_discontinuations").select("brand_id,ean,discontinued_on,evidence_url"),
  ]);
  if([brandsResult,productsResult,specsResult,offersResult,commResult,retiredResult].some(x=>x.error))
    throw new Error("Impossible de charger l'audit Althesia.");
  const brands=brandsResult.data??[],allProducts=productsResult.data??[],
    specs=specsResult.data??[],offers=offersResult.data??[],comms=commResult.data??[];
  const ids=new Set(specs.map(s=>s.product_id));
  const retired=new Map((retiredResult.data??[]).map(x=>[x.brand_id+":"+x.ean,x]));
  const historical=allProducts.filter(x=>ids.has(x.id)&&retired.has(x.brand_id+":"+x.ean));
  const products=allProducts.filter(x=>ids.has(x.id)&&!retired.has(x.brand_id+":"+x.ean));
  const showingArchives=f.statut==="archives";
  const brandId=brands.find(x=>x.slug===f.marque)?.id??"";
  const query=(f.q??"").trim().toLocaleLowerCase("fr").slice(0,100);
  const visible=(showingArchives?historical:products).filter(x=>(!brandId||x.brand_id===brandId)
    && (!query||[x.name,x.sku,x.ean].join(" ").toLocaleLowerCase("fr").includes(query)));
  const getSpec=(id:string)=>specs.find(x=>x.product_id===id);
  const getBrand=(id:string)=>brands.find(x=>x.id===id);
  const countBrand=(id:string)=>products.filter(x=>x.brand_id===id);
  return <div className="space-y-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#a55925]">Contrôle des sources</p>
      <h1 className="mt-2 text-3xl font-bold">Althesia — Données et conformité</h1>
      <p className="mt-2 text-sm leading-6 text-[#6e7d89]">
        Les informations extraites des PDF et d'EasyVRP sont préparées en brouillon.
        Les prix ne sont pas reconfirmés et aucune fiche n'est publiée commercialement.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/app/commissions" className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white">Paramétrer commissions & primes</Link>
        <Link href="/app/qualite" className="rounded-lg border px-4 py-3 text-sm font-semibold">Contrôle catalogue</Link>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Références au catalogue",products.length],
        ["Références archivées",historical.length],
        ["Visuels manquants",products.filter(x=>!x.image_url).length],
        ["Références sous vigilance CBD",specs.filter(x=>x.market_status==="food_cbd_blocked"&&products.some(p=>p.id===x.product_id)).length],
        ["Offres à reconfirmer",offers.filter(x=>!x.price_confirmed&&products.some(p=>p.id===x.product_id)).length],
      ].map(([name,value])=><div key={name} className="rounded-xl border bg-white p-5">
        <p className="text-xs font-semibold text-[#687986]">{name}</p>
        <p className="mt-3 text-3xl font-extrabold">{value}</p>
      </div>)}
    </div>
    <section className="grid gap-3 sm:grid-cols-3">
      {brands.map(b=>{
        const all=countBrand(b.id),c=comms.find(x=>x.brand_id===b.id);
        return <Link href={"/app/althesia?marque="+b.slug} key={b.id}
          className="rounded-xl border bg-white p-5 hover:border-[#879daa]">
          <h2 className="font-bold">{b.name}</h2>
          <p className="mt-2 text-2xl font-extrabold">{all.length} <span className="text-xs font-normal text-[#6e7d8b]">références</span></p>
          <p className="mt-2 text-xs text-[#71818c]">{all.filter(p=>!p.image_url).length} visuel(s) manquant(s) · {all.filter(p=>p.published).length} publiée(s)</p>
          <p className="mt-1 text-xs font-semibold text-[#995825]">Commission : {c?.rate_percent??"—"} % · {c?.review_status==="confirmed"?"confirmée":"brouillon"}</p>
        </Link>;
      })}
    </section>
    <section className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b p-5">
        <h2 className="text-lg font-bold">{showingArchives?"Archives de catalogue":"Références à valider"}</h2>
        <form method="GET" action="/app/althesia" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-semibold">Marque
            <select name="marque" defaultValue={f.marque??""} className="rounded-lg border bg-white p-2 text-sm">
              <option value="">Toutes</option>
              {brands.map(b=><option key={b.id} value={b.slug}>{b.name}</option>)}
            </select></label>
          <label className="grid gap-1 text-xs font-semibold">Statut
            <select name="statut" defaultValue={showingArchives?"archives":"actifs"} className="rounded-lg border bg-white p-2 text-sm">
              <option value="actifs">Catalogue actuel</option>
              <option value="archives">Archives ({historical.length})</option>
            </select></label>
          <label className="grid gap-1 text-xs font-semibold">Produit / EAN
            <input name="q" type="search" defaultValue={f.q??""} className="rounded-lg border p-2 text-sm"/></label>
          <button className="rounded-lg border px-4 py-2 text-xs font-bold">Filtrer</button>
        </form>
      </div>
      <div className="divide-y">
        {visible.map(p=>{
          const s=getSpec(p.id),b=getBrand(p.brand_id);
          return <article key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7a8993]">{b?.name} · {s?.sub_brand}</p>
              <h3 className="mt-1 font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-[#72828e]">EAN {p.ean??"—"} · {s?.source_document}, p. {s?.source_page??"—"}</p>
              {showingArchives?<p className="mt-2 text-xs font-bold text-[#a25233]">Référence arrêtée au {retired.get(p.brand_id+":"+p.ean)?.discontinued_on} — retirée du catalogue</p>:null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {!p.image_url?<span className="inline-flex items-center gap-1 text-[#9a5b2a]"><ImageOff size={13}/> Photo manquante</span>:null}
                {!s?.ingredients_and_doses?<span className="inline-flex items-center gap-1 text-[#9a5b2a]"><FileText size={13}/> Composition à obtenir</span>:null}
                {showingArchives?<span className="font-semibold text-[#a25233]">Archivée / non commercialisée</span>:s?.market_status==="food_cbd_blocked"?<span className="inline-flex items-center gap-1 font-bold text-red-700"><ShieldAlert size={13}/> Cannabinoïdes · vérification juridique</span>:
                  <span className="text-[#ac692c]">Validation de conformité requise</span>}
              </div>
            </div>
            {showingArchives?<a href={retired.get(p.brand_id+":"+p.ean)?.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline">Preuve VIDAL</a>:null}
            <Link href={"/app/produits/"+p.id}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold hover:bg-[#f5f7f8]">Modifier <ArrowUpRight size={13}/></Link>
          </article>;
        })}
        {!visible.length&&<p className="p-8 text-sm text-[#75838e]">Aucun résultat pour ces filtres.</p>}
      </div>
    </section>
  </div>;
}
