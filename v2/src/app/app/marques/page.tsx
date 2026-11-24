import Link from "next/link";
import {requireOwner} from "@/lib/auth";
import {createBrandAction} from "../actions";
import {ArrowRight,Boxes,CheckCircle2,ClipboardList,Search,ShieldAlert,Tag} from "lucide-react";

export default async function BrandHub({searchParams}:{
  searchParams:Promise<{q?:string}>
}){
  const {db}=await requireOwner();
  const {q}=await searchParams;
  const search=(q??"").trim().toLocaleLowerCase("fr").slice(0,80);
  const [b,p,o,c,t,d,stopped]=await Promise.all([
    db.from("brands").select("id,name,slug,active").order("name"),
    db.from("products").select("id,brand_id,ean,published,requires_review,price_verified,image_url"),
    db.from("brand_implantation_offers").select("id,brand_id,published,verification_status"),
    db.from("brand_commission_settings").select("brand_id,rate_percent,review_status"),
    db.from("brand_trade_terms").select("brand_id,verified"),
    db.from("brand_discovery_directory").select("brand_id,discoverable"),
    db.from("product_discontinuations").select("brand_id,ean"),
  ]);
  if([b,p,o,c,t,d,stopped].some(x=>x.error))throw new Error("Gestion des marques indisponible.");
  const brands=b.data??[],allProducts=p.data??[],offers=o.data??[],commissions=c.data??[],
    retired=new Set((stopped.data??[]).map(x=>x.brand_id+":"+x.ean)),
    products=allProducts.filter(x=>!retired.has(x.brand_id+":"+x.ean)),
    terms=t.data??[],directory=d.data??[];
  const visible=brands.filter(x=>!search||x.name.toLocaleLowerCase("fr").includes(search)||x.slug.includes(search));
  const readyBrands=brands.filter(x=>x.active).length;
  const discovers=directory.filter(x=>x.discoverable).length;
  const drafts=offers.filter(x=>x.verification_status!=="verified").length;
  return <div className="space-y-7 pb-12">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a35f2c]">TR1 PHARMA · Cockpit administrateur</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#142941]">Gestion des marques</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#677a88]">
        Un seul point d'entrée pour les produits, les packs d'implantation, les conditions fournisseur,
        les commissions et la visibilité des marques.
      </p>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Marques gérées",brands.length,Boxes],
        ["Dans la découverte",discovers,Tag],
        ["Catalogues commerciaux actifs",readyBrands,CheckCircle2],
        ["Offres à confirmer",drafts,ClipboardList],
      ].map(([label,count,Icon])=>{
        const Symbol=Icon as typeof Boxes;
        return <div key={String(label)} className="rounded-xl border border-[#e0e6e9] bg-white p-5">
          <Symbol size={20} className="text-[#54768a]"/>
          <p className="mt-3 text-xs font-semibold text-[#6c7e8a]">{String(label)}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#142941]">{String(count)}</p>
        </div>;
      })}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form method="GET" className="flex min-w-[230px] flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 sm:max-w-md">
        <Search size={16} className="shrink-0 text-[#718594]"/>
        <input type="search" name="q" defaultValue={q??""} placeholder="Rechercher une marque…"
          className="min-w-0 flex-1 bg-transparent p-1 text-sm outline-none"/>
        <button className="rounded-md bg-[#142941] px-4 py-2 text-xs font-semibold text-white">Chercher</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app/medias?statut=attente" className="rounded-lg border border-[#dfc7a6] bg-[#fff9ee] px-4 py-3 text-xs font-semibold text-[#8b592a]">
          Contrôler les photos produits
        </Link>
      <Link href="/app/implantations" className="rounded-lg border bg-white px-4 py-3 text-xs font-semibold text-[#284f67]">Suivi des implantations pharmacies</Link>
      </div>
    </div>
    <section className="grid gap-4 md:grid-cols-2">
      {visible.map(brand=>{
        const items=products.filter(x=>x.brand_id===brand.id);
        const brandOffers=offers.filter(x=>x.brand_id===brand.id);
        const commission=commissions.find(x=>x.brand_id===brand.id);
        const verifiedTerm=terms.find(x=>x.brand_id===brand.id)?.verified??false;
        const isDiscoverable=directory.some(x=>x.brand_id===brand.id&&x.discoverable);
        const issues=items.filter(x=>x.requires_review||!x.price_verified||!x.image_url).length;
        const verifiedOffers=brandOffers.filter(x=>x.verification_status==="verified").length;
        return <article key={brand.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e0e6e9] bg-white shadow-[0_3px_15px_rgb(14_29_49/0.035)]">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <h2 className="text-xl font-extrabold text-[#142941]">{brand.name}</h2>
              <p className="mt-1 font-mono text-[11px] text-[#87939c]">{brand.slug}</p>
            </div>
            <span className={"rounded-lg px-3 py-1.5 text-[11px] font-bold "+(brand.active?"bg-green-50 text-green-800":"bg-[#eef2f4] text-[#5f7180]")}>
              {brand.active?"Catalogue commercial actif":"Catalogue commercial fermé"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 px-6">
            <span className={"rounded-md px-2 py-1 text-[11px] font-semibold "+(isDiscoverable?"bg-[#eaf1f5] text-[#315c75]":"bg-[#f3f5f6] text-[#75838d]")}>
              {isDiscoverable?"Visible dans Découvrir":"Non visible dans Découvrir"}
            </span>
            {issues>0?<span className="inline-flex items-center gap-1 rounded-md bg-[#fff4e6] px-2 py-1 text-[11px] font-semibold text-[#8d602d]">
              <ShieldAlert size={13}/> {issues} fiches à vérifier
            </span>:null}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[#ebeff1] bg-[#fafbfb] px-6 py-4 text-sm">
            <div><strong className="text-lg text-[#142941]">{items.length}</strong><p className="text-xs text-[#71808a]">Références au catalogue · {items.filter(x=>x.published).length} publiées · {allProducts.filter(x=>x.brand_id===brand.id).length-items.length} archivées</p></div>
            <div><strong className="text-lg text-[#142941]">{brandOffers.length}</strong><p className="text-xs text-[#71808a]">Offres · {verifiedOffers} confirmées</p></div>
            <div><p className="font-semibold">{verifiedTerm?"Vérifiées":"À vérifier"}</p><p className="text-xs text-[#71808a]">Conditions fournisseur</p></div>
            <div><p className="font-semibold">{commission?Number(commission.rate_percent).toLocaleString("fr-FR")+" %":"Non renseignée"}</p>
              <p className="text-xs text-[#71808a]">Commission TR1 {commission?.review_status==="confirmed"?"confirmée":"non confirmée"}</p></div>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-6 py-5">
            <p className="text-xs text-[#7d8992]">Gérer sans activer automatiquement la vente.</p>
            <Link href={"/app/marques/"+brand.id} className="inline-flex items-center gap-2 rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white hover:bg-[#29445d]">
              Gérer {brand.name} <ArrowRight size={15}/>
            </Link>
          </div>
        </article>;
      })}
    </section>
    {!visible.length?<p className="rounded-xl border bg-white p-7 text-sm text-[#6d7c87]">Aucune marque ne correspond à ta recherche.</p>:null}
    <details className="rounded-xl border bg-white p-6">
      <summary className="cursor-pointer text-base font-bold text-[#142941]">Ajouter une nouvelle marque</summary>
      <p className="mt-3 text-xs text-[#6e7e89]">La marque est créée inactive, sans produits publiés ni rémunération attribuée.</p>
      <form action={createBrandAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <input name="name" required minLength={2} placeholder="Nom de la marque" className="rounded-lg border p-3 text-sm"/>
        <input name="slug" required pattern="[a-z0-9-]+" placeholder="identifiant-url" className="rounded-lg border p-3 text-sm"/>
        <button className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white">Créer en brouillon</button>
      </form>
    </details>
  </div>;
}
