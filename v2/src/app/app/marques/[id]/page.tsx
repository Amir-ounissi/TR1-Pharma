import Link from "next/link";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/auth";
import {saveBrandPresentationAction} from "../actions";
import {ArrowRight,Box,CheckCircle2,ClipboardList,Cog,FileCheck,Package,ShieldAlert,Wallet} from "lucide-react";

const tabs=[
 {key:"apercu",label:"Vue d'ensemble"},
 {key:"produits",label:"Produits"},
 {key:"implantation",label:"Offres & packs"},
 {key:"conditions",label:"Conditions"},
 {key:"commissions",label:"Commissions"},
 {key:"visibilite",label:"Présentation"},
];
function ActionLink({href,children}: {href:string;children:React.ReactNode}) {
 return <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white hover:bg-[#29465f]">
   {children}<ArrowRight size={15}/>
 </Link>;
}
function Metric({name,value,detail}:{name:string;value:string|number;detail?:string}) {
 return <div className="rounded-xl border border-[#e0e7eb] bg-white p-4">
  <p className="text-xs font-semibold text-[#71818c]">{name}</p>
  <p className="mt-2 text-2xl font-extrabold text-[#142941]">{value}</p>
  {detail?<p className="mt-1 text-[11px] text-[#85919a]">{detail}</p>:null}
 </div>;
}
export default async function BrandSettingsPage({params,searchParams}:{
 params:Promise<{id:string}>;searchParams:Promise<{onglet?:string;enregistre?:string}>
}) {
 const [{id},query]=await Promise.all([params,searchParams]);
 const {db}=await requireOwner();
 const {data:brand,error:brandError}=await db.from("brands")
  .select("id,name,slug,active").eq("id",id).maybeSingle();
 if(brandError)throw new Error("Impossible de charger la marque.");
 if(!brand)notFound();
 const [p,o,t,c,bonus,d,r,lead,stopped]=await Promise.all([
  db.from("products").select("id,name,ean,sku,published,requires_review,price_verified,image_url,fr_market_checked")
    .eq("brand_id",id).order("name"),
  db.from("brand_implantation_offers").select("id,title,offer_kind,min_distinct_references,min_units_per_reference,free_units_per_reference,min_order_ht,verification_status,pilot_visible,published")
    .eq("brand_id",id).order("created_at",{ascending:true}),
  db.from("brand_trade_terms").select("*").eq("brand_id",id).maybeSingle(),
  db.from("brand_commission_settings").select("*").eq("brand_id",id).maybeSingle(),
  db.from("brand_bonus_rules").select("id,title,amount,bonus_type,review_status").eq("brand_id",id),
  db.from("brand_discovery_directory").select("*").eq("brand_id",id).maybeSingle(),
  db.from("pharmacy_brand_relationships").select("pharmacy_id,status").eq("brand_id",id),
  db.from("brand_referencing_interests").select("id,status").eq("brand_id",id),
  db.from("product_discontinuations").select("ean,discontinued_on").eq("brand_id",id),
 ]);
 if([p,o,t,c,bonus,d,r,lead,stopped].some(x=>x.error))throw new Error("Données de la marque indisponibles.");
 const allProducts=p.data??[],retiredEans=new Set((stopped.data??[]).map(x=>x.ean));
 const products=allProducts.filter(x=>!retiredEans.has(x.ean));
 const retiredCount=allProducts.length-products.length;
 const offers=o.data??[],terms=t.data,commission=c.data;
 const bonuses=bonus.data??[],directory=d.data,relationships=r.data??[],interests=lead.data??[];
 const published=products.filter(x=>x.published).length;
 const unchecked=products.filter(x=>x.requires_review||!x.price_verified||!x.image_url||!x.fr_market_checked).length;
 const confirmed=offers.filter(x=>x.verification_status==="verified").length;
 const implanted=relationships.filter(x=>x.status==="implanted").length;
 const tab=tabs.some(x=>x.key===query.onglet)?query.onglet:"apercu";
 const base="/app/marques/"+brand.id;
 const offersLink="/app/offres-implantation?marque="+brand.slug;
 const productsLink="/app/produits?marque="+brand.id;
 const termsLink="/app/conditions?marque="+brand.id;
 const commissionLink="/app/commissions?marque="+brand.slug;
 return <div className="space-y-6 pb-12">
  <nav aria-label="Fil d'Ariane" className="text-xs text-[#778590]">
   <Link href="/app/marques" className="hover:underline">Gestion des marques</Link><span className="mx-2">/</span>
   <strong className="text-[#142941]">{brand.name}</strong>
  </nav>
  <header className="flex flex-wrap items-start justify-between gap-4">
   <div>
    <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a05e30]">Fiche marque · TR1 PHARMA</p>
    <h1 className="mt-2 text-3xl font-extrabold text-[#142941]">{brand.name}</h1>
    <p className="mt-2 text-sm text-[#71818d]">Toutes les opérations sur cette marque réunies au même endroit.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <span className={"rounded-lg px-3 py-2 text-xs font-bold "+(brand.active?"bg-[#eaf4ed] text-[#38714f]":"bg-[#edf1f3] text-[#627483]")}>
     {brand.active?"Catalogue commercial actif":"Catalogue commercial fermé"}
    </span>
    <span className={"rounded-lg px-3 py-2 text-xs font-bold "+(directory?.discoverable?"bg-[#eaf1f6] text-[#315b73]":"bg-[#f5f6f6] text-[#7a8792]")}>
     {directory?.discoverable?"Découverte visible":"Découverte masquée"}
    </span>
   </div>
  </header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Metric name="Références au catalogue" value={products.length} detail={published+" publiées · "+retiredCount+" archives"}/>
   <Metric name="Offres & packs" value={offers.length} detail={confirmed+" confirmé(s)"}/>
   <Metric name="Pharmacies implantées" value={implanted} detail="Statuts suivis par officine"/>
   <Metric name="Demandes de présentation" value={interests.filter(x=>x.status!=="closed").length}/>
  </div>
  <nav aria-label="Rubriques de la marque" className="flex flex-wrap gap-2 rounded-xl border border-[#e1e7eb] bg-white p-2">
   {tabs.map(x=><Link key={x.key} href={base+"?onglet="+x.key}
     aria-current={tab===x.key?"page":undefined}
     className={"rounded-lg px-4 py-2.5 text-xs font-semibold transition "+
      (tab===x.key?"bg-[#142941] text-white":"text-[#547085] hover:bg-[#f1f5f7]")}>
      {x.label}
     </Link>)}
  </nav>
  {tab==="apercu"?<div className="space-y-5">
   <section className="rounded-xl border bg-white p-6">
    <h2 className="text-lg font-bold">Ce qu'il reste à préparer</h2>
    <p className="mt-2 text-sm text-[#71818c]">Les trois circuits restent séparés : présentation aux pharmacies, conditions fournisseur et rémunération de TR1.</p>
    <div className="mt-5 divide-y">
     {[
       {title:"Catalogue produits",value:unchecked?"À contrôler : "+unchecked+" fiche(s)":"Fiches connues contrôlées",detail:products.length+" référence(s), "+published+" publiée(s)",href:base+"?onglet=produits",Icon:Package},
       {title:"Implantation et packs",value:offers.length?confirmed+"/"+offers.length+" offre(s) confirmée(s)":"Aucune offre configurée",detail:"Références minimum, UG, PLV et logistique",href:base+"?onglet=implantation",Icon:Box},
       {title:"Conditions fournisseur",value:terms?.verified?"Contrôlées":"En attente de vérification",detail:"Minimum de commande, livraison et frais de port",href:base+"?onglet=conditions",Icon:FileCheck},
       {title:"Commission et primes TR1",value:commission?(Number(commission.rate_percent).toLocaleString("fr-FR")+" % — "+(commission.review_status==="confirmed"?"confirmé":"brouillon")):"Commission à renseigner",detail:bonuses.length+" prime(s) enregistrée(s), privé administrateur",href:base+"?onglet=commissions",Icon:Wallet},
       {title:"Présentation aux pharmacies",value:directory?.discoverable?"Visible en découverte":"Masquée en découverte",detail:implanted+" implantation(s) suivie(s)",href:base+"?onglet=visibilite",Icon:Cog},
     ].map(x=><Link href={x.href} key={x.title} className="flex items-center gap-3 py-4 hover:bg-[#f9fbfc]">
       <div className="rounded-lg bg-[#eff3f5] p-2.5"><x.Icon size={18} className="text-[#466a7f]"/></div>
       <div className="min-w-0 flex-1">
         <p className="text-sm font-bold">{x.title}</p>
         <p className="mt-1 text-xs text-[#74838e]">{x.detail}</p>
       </div>
       <span className="max-w-36 text-right text-xs font-semibold text-[#48677d]">{x.value}</span>
       <ArrowRight size={16} className="text-[#9babba]"/>
     </Link>)}
    </div>
   </section>
   <div className="rounded-xl border border-[#e8decf] bg-[#fffbf4] p-5 text-xs leading-6 text-[#7b5b38]">
    <ShieldAlert size={18} className="mb-2"/>
    <p><strong>Important :</strong> rendre une marque visible dans « Découvrir » ne la déclare pas implantée, ne publie pas ses produits et n'active pas les commandes. Les taux de commission ne sont jamais visibles côté pharmacie.</p>
   </div>
  </div>:null}
  {tab==="produits"?<section className="rounded-xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Catalogue {brand.name}</h2><p className="mt-2 text-sm text-[#768591]">{products.length} références au catalogue · {retiredCount} archivées · {unchecked} fiches à vérifier.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {retiredCount>0?<Link href={"/app/produits?marque="+brand.id+"&statut=archives"} className="rounded-lg border px-4 py-3 text-xs font-bold">Voir les archives ({retiredCount})</Link>:null}
        <ActionLink href={productsLink}>Gérer les produits</ActionLink>
      </div>
    </div>
    <div className="mt-5 divide-y">
      {products.slice(0,40).map(x=><div key={x.id} className="flex flex-wrap justify-between gap-3 py-3">
        <div><Link href={"/app/produits/"+x.id} className="text-sm font-semibold hover:underline">{x.name}</Link>
          <p className="mt-1 text-xs text-[#7a8892]">EAN {x.ean||"manquant"} · {x.sku}</p></div>
        <span className="text-xs font-semibold text-[#688092]">{x.published?"Publiée":x.requires_review?"À vérifier":"Brouillon"}</span>
      </div>)}
      {!products.length?<p className="py-5 text-sm text-[#77858f]">Aucun produit : commence par créer les références.</p>:null}
    </div>
    {products.length>40?<Link href={productsLink} className="mt-4 inline-block text-sm font-semibold underline">Voir les {products.length} références</Link>:null}
  </section>:null}
  {tab==="implantation"?<section className="rounded-xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Packs et offres d'implantation</h2>
        <p className="mt-2 text-sm text-[#768591]">Offres distinctes des réassorts et des primes de TR1.</p></div>
      <ActionLink href={offersLink}>Créer / modifier les offres</ActionLink>
    </div>
    <div className="mt-5 divide-y">
      {offers.map(x=><div key={x.id} className="flex flex-wrap justify-between gap-4 py-4">
        <div><strong className="text-sm">{x.title}</strong>
          <p className="mt-1 text-xs leading-5 text-[#74838e]">
            {x.offer_kind==="fixed_pack"?"Pack fixe":x.offer_kind==="quantity_tier"?"Palier fournisseur":"Choix libre"}
            {" · "}Min. {x.min_distinct_references??"?"} référence(s)
            {" · "}{x.min_units_per_reference??"?"} unité(s) par réf.
            {" · "}{x.free_units_per_reference} UG
          </p></div>
        <div className="text-right text-xs">
          <p className="font-bold text-[#405e75]">{x.published?"Publiée":x.verification_status==="verified"?"Confirmée":"À confirmer"}</p>
          <p className="mt-1 text-[#778791]">{x.pilot_visible?"Visible en test":"Masquée en test"}</p>
        </div>
      </div>)}
      {!offers.length?<p className="py-5 text-sm text-[#768591]">Aucune offre : configure le premier pack ou palier de lancement.</p>:null}
    </div>
  </section>:null}
  {tab==="conditions"?<section className="rounded-xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Conditions commerciales fournisseur</h2>
        <p className="mt-1 text-sm text-[#768591]">{terms?.verified?"Conditions contrôlées":"Conditions non confirmées"}</p></div>
      <ActionLink href={termsLink}>Modifier les conditions</ActionLink>
    </div>
    <dl className="mt-5 grid gap-4 rounded-xl bg-[#f7f9fa] p-5 text-sm sm:grid-cols-2">
      {[
        ["Minimum HT",terms?.minimum_order_ht==null?"À confirmer":Number(terms.minimum_order_ht).toFixed(2)+" €"],
        ["Minimum unités",terms?.minimum_order_units??"À confirmer"],
        ["Franco de port",terms?.free_shipping_from_ht==null?"À confirmer":Number(terms.free_shipping_from_ht).toFixed(2)+" € HT"],
        ["Frais de port",terms?.shipping_fee_ht==null?"À confirmer":Number(terms.shipping_fee_ht).toFixed(2)+" € HT"],
        ["Email fournisseur",terms?.order_email||"Non renseigné"],
      ].map(([label,value])=><div key={String(label)}>
        <dt className="text-xs text-[#72818c]">{label}</dt><dd className="mt-1 font-semibold text-[#263f54]">{value}</dd>
      </div>)}
    </dl>
    <p className="mt-4 text-xs leading-5 text-[#6d7f8b]">Ces conditions concernent les pharmacies et le fournisseur, pas les commissions TR1.</p>
  </section>:null}
  {tab==="commissions"?<section className="rounded-xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Commission et primes TR1</h2>
        <p className="mt-1 text-sm text-[#6e7c89]">Réservé à ton compte administrateur, invisible pour les pharmacies.</p></div>
      <ActionLink href={commissionLink}>Gérer la rémunération</ActionLink>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <Metric name="Commission" value={commission?Number(commission.rate_percent).toLocaleString("fr-FR")+" %":"À définir"}/>
      <Metric name="Statut contractuel" value={commission?.review_status==="confirmed"?"Confirmé":"À confirmer"}/>
      <Metric name="Primes supplémentaires" value={bonuses.length}/>
    </div>
    <p className="mt-4 text-sm leading-6 text-[#72818c]">Le taux ne suffit pas : l'assiette, le fait générateur et les justificatifs déterminent les commissions réellement acquises.</p>
    {bonuses.length?<div className="mt-4 divide-y rounded-xl border">
      {bonuses.map(x=><div key={x.id} className="flex justify-between gap-3 p-4 text-sm">
        <span>{x.title}</span><strong>{x.amount} {x.bonus_type==="percent"?"%":"€"}</strong>
      </div>)}
    </div>:null}
  </section>:null}
  {tab==="visibilite"?<section className="rounded-xl border bg-white p-6">
    <h2 className="text-xl font-bold">Présentation de la marque aux pharmacies</h2>
    <p className="mt-2 text-sm text-[#72818c]">Définis son texte de présentation et son affichage dans « Découvrir ». Aucun catalogue commercial n'est activé par ce formulaire.</p>
    {query.enregistre==="1"?<p role="status" className="mt-4 rounded-lg bg-[#eef6f0] p-3 text-sm font-semibold text-[#397353]">Présentation mise à jour.</p>:null}
    <form action={saveBrandPresentationAction} className="mt-5 space-y-4">
      <input type="hidden" name="brand_id" value={brand.id}/>
      <label className="block text-xs font-semibold text-[#587084]">Description courte
        <textarea name="short_description" rows={3} maxLength={500}
          defaultValue={directory?.short_description??""} placeholder="Positionnement et catégories de la marque"
          className="mt-1 w-full rounded-lg border p-3 text-sm"/></label>
      <label className="block text-xs font-semibold text-[#587084]">Message complémentaire
        <textarea name="catalogue_note" rows={3} maxLength={1200}
          defaultValue={directory?.catalogue_note??""} placeholder="Conditions à confirmer, statut des fiches…"
          className="mt-1 w-full rounded-lg border p-3 text-sm"/></label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input name="discoverable" value="yes" type="checkbox" defaultChecked={directory?.discoverable??false}/>
        Visible dans « Découvrir de nouvelles marques »
      </label>
      <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Enregistrer la présentation</button>
    </form>
    <div className="mt-6 border-t pt-5">
      <h3 className="text-base font-bold">Implantations et droits d'accès</h3>
      <p className="mt-2 text-sm text-[#72818c]">{implanted} pharmacie(s) signalée(s) comme implantée(s). Ces statuts se gèrent officine par officine ; les accès commerciaux se gèrent séparément.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/app/implantations" className="rounded-lg border px-4 py-3 text-xs font-bold">Statuts d'implantation</Link>
        <Link href="/app/acces" className="rounded-lg border px-4 py-3 text-xs font-bold">Autorisations B2B</Link>
      </div>
    </div>
  </section>:null}
  <Link href="/app/marques" className="inline-flex items-center gap-2 text-sm font-semibold text-[#245671] underline underline-offset-2">
    <ArrowRight size={15} className="rotate-180"/> Toutes les marques
  </Link>
 </div>;
}
