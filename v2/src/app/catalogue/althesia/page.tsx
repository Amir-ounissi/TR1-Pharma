import Link from "next/link";
import { Search, PackageOpen, ShieldAlert, ArrowUpRight, BookOpen, ClipboardList } from "lucide-react";
import { loadAlthesiaShowroom, euro, isBlocked } from "@/lib/althesia-showroom";
import { normalizedSearch } from "@/lib/demo-display";

type Filters = { q?:string; marque?:string; rayon?:string };
export default async function AlthesiaPreview({searchParams}:{searchParams:Promise<Filters>}) {
  const products=await loadAlthesiaShowroom();
  const filter=await searchParams;
  const brandSlugs=["vitalora","bloomster","noto"];
  const selectedBrand=brandSlugs.includes(filter.marque??"")?filter.marque??"":"";
  const search=(filter.q??"").trim().slice(0,100);
  const key=normalizedSearch(search);
  const categories=[...new Set(products.map(x=>x.category||"Non classé"))]
    .sort((a,b)=>a.localeCompare(b,"fr"));
  const cat=categories.includes(filter.rayon??"")?filter.rayon??"":"";
  const visible=products.filter(x=>
    (!selectedBrand||x.brand_slug===selectedBrand) &&
    (!cat||x.category===cat) &&
    (!key||normalizedSearch([x.name,x.ean,x.sku,x.brand,x.category,x.ingredients].filter(Boolean).join(" ")).includes(key))
  );
  return <div className="space-y-6 pb-14">
    <nav aria-label="Fil d'Ariane" className="text-xs text-[#6c7b86]">
      <Link href="/catalogue" className="hover:underline">Espace professionnel</Link>
      <span className="mx-2">/</span>Althesia · Documentation
    </nav>
    <header className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#efbf91]">TR1 PHARMA / OFFICINE PILOTE</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Les marques Althesia</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d7e0e7]">
        {products.length} références des marques représentées, y compris celles sous contrôle réglementaire.
        TR1 PHARMA intervient comme agent commercial : présentation et mise en relation,
        sans vente, facturation ni livraison par TR1.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {[
          {slug:"vitalora",label:"Vitalora"},
          {slug:"bloomster",label:"Bloomster"},
          {slug:"noto",label:"Nōto"},
        ].map(b=><Link key={b.slug} href={b.slug?"/catalogue/althesia?marque="+b.slug:"/catalogue/althesia"}
          className="rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">
          {b.label} <span className="ml-1 text-white/70">({products.filter(p=>p.brand_slug===b.slug).length})</span>
        </Link>)}
      </div>
    </header>

    <section className="rounded-xl border border-[#eedcc3] bg-[#fff9ee] px-5 py-4">
      <div className="flex gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-[#9c5923]" size={20}/>
        <div>
          <h2 className="text-sm font-bold text-[#7a4c26]">Toutes les références du fournisseur · consultation professionnelle</h2>
          <p className="mt-1 text-xs leading-5 text-[#835c36]">
            Les données présentées proviennent des catalogues fournisseurs et ne constituent pas une offre ferme.
            Les tarifs historiques sont à reconfirmer auprès du mandant. Les références contenant des cannabinoïdes
            restent consultables pour identification, sans prix d'achat ni parcours de commande.
            TR1 ne vend ni ne facture les produits.
          </p>
        </div>
      </div>
    </section>

    <section className="rounded-xl border border-[#e0e7e9] bg-white p-4">
      <form method="GET" action="/catalogue/althesia" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_165px_215px_auto]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[#607181]">Rechercher</span>
          <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-[#7e8c97]"/>
            <input name="q" type="search" defaultValue={search} placeholder="Nom, actif, EAN, référence..."
              className="h-11 w-full rounded-lg border border-[#d7e0e4] bg-white pl-10 pr-3 text-sm"/>
          </div>
        </label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#607181]">Marque</span>
          <select name="marque" defaultValue={selectedBrand} className="h-11 w-full rounded-lg border border-[#d7e0e4] bg-white px-3 text-sm">
            <option value="">Toutes</option>
            <option value="vitalora">Vitalora</option>
            <option value="bloomster">Bloomster</option>
            <option value="noto">Nōto</option>
          </select>
        </label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#607181]">Rayon</span>
          <select name="rayon" defaultValue={cat} className="h-11 w-full rounded-lg border border-[#d7e0e4] bg-white px-3 text-sm">
            <option value="">Tous les rayons</option>
            {categories.map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <button className="h-11 self-end rounded-lg bg-[#142941] px-5 text-sm font-semibold text-white">Filtrer</button>
      </form>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-[#142941]">{visible.length} références à consulter</h2>
        <p className="mt-1 text-xs text-[#78858f]">Document source et statut de vérification sur chaque fiche.</p></div>
      <Link href="/catalogue/demo" className="text-xs font-semibold text-[#246080] hover:underline">Retour au panier Vitalora TEST</Link>
    </div>

    {visible.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(p=>{
        const first=p.offers[0],blocked=isBlocked(p);
        return <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e0e6e8] bg-white shadow-[0_2px_12px_rgb(14_29_49/0.035)]">
          <Link href={`/catalogue/althesia/produit/${p.id}`} className="group flex h-44 items-center justify-center border-b bg-[#f7f9f9] px-6 py-4">
            {p.image_url?<img src={p.image_url} alt={p.name} className="h-full max-w-full object-contain transition group-hover:scale-105" loading="lazy"/>:
              <div className="text-center text-[#9aabb5]"><PackageOpen size={34} className="mx-auto"/><p className="mt-2 text-xs">Visuel à intégrer</p></div>}
          </Link>
          <div className="flex flex-1 flex-col gap-2 p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f798d]">{p.brand} {p.sub_brand&&p.sub_brand!==p.brand?"· "+p.sub_brand:""}</p>
            <Link href={`/catalogue/althesia/produit/${p.id}`} className="line-clamp-2 min-h-12 text-lg font-bold text-[#142941] hover:underline">{p.name}</Link>
            <p className="text-xs text-[#73838e]">{p.format||"Format à confirmer"} · EAN {p.ean||"—"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${blocked?"bg-red-50 text-red-800":"bg-[#fff4e4] text-[#955822]"}`}>
                {blocked?"Cannabinoïdes · statut réglementaire à vérifier":"Conditions fournisseur à confirmer"}
              </span>
            </div>
            <div className="mt-2 border-t border-[#edf1f2] pt-3">
              {blocked?
                <><p className="text-[11px] font-semibold text-[#985326]">Informations d'achat non diffusées</p>
                  <p className="mt-1 text-xs leading-5 text-[#6e7d88]">Référence documentaire soumise à une revue réglementaire spécifique.</p></>:
                <><p className="text-[11px] text-[#73828d]">PA HT du fournisseur · 1er palier</p>
                  <p className="text-xl font-extrabold text-[#142941]">{first?euro(first.price_ht):"Non renseigné"} <span className="text-xs font-normal text-[#697782]">/ unité</span></p>
                  <p className="mt-1 text-xs text-[#6e7d88]">PVC TTC source : {euro(p.retail_ttc)} · Minimum : {first?.paid_quantity??"—"} u.</p></>}
            </div>
            <Link href={`/catalogue/althesia/produit/${p.id}`} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white hover:bg-[#26425b]">
              <BookOpen size={15}/> Consulter la fiche <ArrowUpRight size={14}/>
            </Link>
          </div>
        </article>;
      })}
    </div>:<div className="rounded-xl border bg-white p-10 text-center"><ClipboardList className="mx-auto text-[#93a2ac]"/>
      <p className="mt-3 text-sm font-semibold">Aucun produit ne correspond à ces filtres.</p>
      <Link href="/catalogue/althesia" className="mt-3 inline-block text-sm underline">Réinitialiser les filtres</Link>
    </div>}
    <p className="text-xs leading-6 text-[#74828d]">TR1 PHARMA : intermédiaire commercial, non vendeur des références affichées. Les éventuels devis, disponibilités, contrats et facturations relèvent du fournisseur selon le mandat convenu. Sources : Althesia et Vitalora (septembre 2026), Bloomster (septembre 2025). Aucune conformité n'est présumée.</p>
  </div>;
}
