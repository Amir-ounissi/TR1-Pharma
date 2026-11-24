import Link from "next/link";
import {requireOwner} from "@/lib/auth";
import {approveProductImageAction,rejectProductImageAction} from "./actions";
import {AlertCircle,CheckCircle2,ImageOff,Images,Search,ShieldCheck} from "lucide-react";

type Filters={marque?:string;statut?:string;confirmation?:string;refus?:string;q?:string};
export default async function PhotoQuality({searchParams}:{searchParams:Promise<Filters>}) {
 const {db}=await requireOwner();
 const filters=await searchParams;
 const [brandsResult,productsResult,auditResult]=await Promise.all([
  db.from("brands").select("id,name,slug").order("name"),
  db.from("products").select("id,brand_id,name,ean,format,sku,image_url,published")
    .order("name").limit(350),
  db.from("product_media_audit")
    .select("product_id,candidate_image_url,source_product_url,source_product_name,matched_by,match_score,image_review_status,applied_to_draft")
    .order("detected_at",{ascending:false}).limit(350),
 ]);
 if(brandsResult.error||productsResult.error||auditResult.error)
  throw new Error("Impossible de charger la vérification des visuels.");
 const brands=brandsResult.data??[],products=productsResult.data??[],audits=auditResult.data??[];
 const brandId=brands.find(x=>x.slug===filters.marque)?.id;
 const status=["attente","sans-photo","valides","tous"].includes(filters.statut??"")?filters.statut:"attente";
 const term=(filters.q??"").toLocaleLowerCase("fr").slice(0,90);
 const auditById=new Map(audits.map(x=>[x.product_id,x]));
 const pending=audits.filter(x=>x.image_review_status==="pending").length;
 const confirmed=audits.filter(x=>x.image_review_status==="verified").length;
 const empty=products.filter(x=>!x.image_url).length;
 const visible=products.filter(p=>{
  const a=auditById.get(p.id);
  if(brandId&&p.brand_id!==brandId)return false;
  if(term&&!([p.name,p.ean,p.sku].filter(Boolean).join(" ").toLocaleLowerCase("fr").includes(term)))return false;
  if(status==="attente")return a?.image_review_status==="pending";
  if(status==="sans-photo")return !p.image_url;
  if(status==="valides")return a?.image_review_status==="verified";
  return true;
 });
 const url=(value:string)=>{
  const query=new URLSearchParams();
  query.set("statut",value);
  if(filters.marque)query.set("marque",filters.marque);
  if(term)query.set("q",term);
  return "/app/medias?"+query.toString();
 };
 return <div className="space-y-6 pb-12">
   <nav className="text-xs text-[#72808b]"><Link href="/app/marques" className="hover:underline">Gestion des marques</Link><span className="mx-2">/</span>Photos produits</nav>
   <header>
     <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b5c2b]">Qualité catalogue · réservé à TR1</p>
     <h1 className="mt-2 text-3xl font-extrabold text-[#142941]">Photos et visuels produits</h1>
     <p className="mt-2 max-w-3xl text-sm leading-6 text-[#697b89]">
       Vérifie les photos récupérées depuis les sites des marques. Comparer visuellement le produit,
       le format et l'EAN avant d'approuver. Une URL fonctionnelle ne prouve pas que l'emballage photographié correspond.
     </p>
   </header>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     {[
      ["Références",products.length,Images],
      ["Visuels provisoires",pending,AlertCircle],
      ["Visuels revus",confirmed,CheckCircle2],
      ["Sans photo",empty,ImageOff],
     ].map(([label,n,Icon])=>{
      const C=Icon as typeof Images;
      return <div key={String(label)} className="rounded-xl border border-[#e1e7eb] bg-white p-5">
       <C className="text-[#5e7b8d]" size={18}/>
       <p className="mt-3 text-xs font-semibold text-[#647987]">{String(label)}</p>
       <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#142941]">{String(n)}</p>
      </div>;
     })}
   </div>
   {filters.confirmation==="1"||filters.refus==="1"?<p role="status" className="rounded-lg bg-[#eff7f1] p-4 text-sm font-semibold text-[#286d47]">{filters.confirmation==="1"?"Photo validée avec son justificatif.":"Photo écartée ; la fiche reste non publiée."}</p>:null}
   <div className="rounded-xl border border-[#eadfc9] bg-[#fffbf3] p-4 text-xs leading-6 text-[#785735]">
    <ShieldCheck className="mb-1" size={17}/>
    Les visuels préremplis restent en attente de validation par TR1. Aucune confirmation d'EAN n'a été automatisée.
    Les photos d'origine antérieures à cet audit sont indiquées « contrôle non documenté ».
   </div>
   <div className="flex flex-wrap gap-2">
    {[
      ["attente","À contrôler",pending],
      ["sans-photo","Photos manquantes",empty],
      ["valides","Validées",confirmed],
      ["tous","Tous les produits",products.length],
    ].map(([key,label,n])=><Link href={url(String(key))} key={String(key)}
      className={"rounded-lg px-3 py-2.5 text-xs font-bold "+(status===key?"bg-[#142941] text-white":"border bg-white text-[#526b7b]")}>
       {label} ({n})
     </Link>)}
   </div>
   <form action="/app/medias" method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
    <input type="hidden" name="statut" value={status}/>
    <label className="min-w-[180px] flex-1 text-xs font-semibold">Marque
     <select name="marque" defaultValue={filters.marque??""} className="mt-1 block w-full rounded-lg border bg-white p-3 text-sm">
      <option value="">Toutes</option>
      {brands.map(x=><option key={x.id} value={x.slug}>{x.name}</option>)}
     </select>
    </label>
    <label className="min-w-[190px] flex-[2] text-xs font-semibold">Référence / EAN
      <div className="relative mt-1">
       <Search className="absolute left-3 top-3.5 text-[#8194a0]" size={15}/>
       <input type="search" name="q" defaultValue={filters.q??""}
        placeholder="Nom du produit ou code EAN"
        className="w-full rounded-lg border p-3 pl-9 text-sm"/>
      </div>
    </label>
    <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Filtrer</button>
   </form>
   {visible.length?<div className="grid gap-4 xl:grid-cols-2">
    {visible.map(p=>{
      const a=auditById.get(p.id),brand=brands.find(b=>b.id===p.brand_id);
      return <article key={p.id} className="overflow-hidden rounded-xl border border-[#e1e8eb] bg-white">
       <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 p-5 sm:grid-cols-[145px_minmax(0,1fr)]">
         <div className="flex h-40 items-center justify-center rounded-lg bg-[#f6f8f8] p-3">
          {p.image_url?<img src={p.image_url} alt={p.name} className="h-full max-w-full object-contain"/>:
          <ImageOff size={32} className="text-[#9eacb5]"/>}
         </div>
         <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#5a798d]">{brand?.name??"Marque"}</p>
          <h2 className="mt-1 text-base font-bold leading-6">{p.name}</h2>
          <p className="mt-2 font-mono text-xs text-[#7e8993]">EAN {p.ean||"Non renseigné"}</p>
          <p className="mt-1 text-xs text-[#71818d]">{p.format||"Format à confirmer"}</p>
          <p className="mt-3 rounded-md bg-[#f1f5f7] px-2 py-1.5 text-[11px] font-semibold text-[#536e81]">
           {a?.image_review_status==="pending"?"PHOTO PROVISOIRE · CONTRÔLE REQUIS":a?.image_review_status==="verified"?"Photo contrôlée":p.image_url?"Visuel antérieur · contrôle non documenté":"Visuel manquant"}
          </p>
          <Link href={"/app/produits/"+p.id} className="mt-3 inline-block text-xs font-semibold text-[#1e5775] underline">Ouvrir la fiche produit</Link>
         </div>
       </div>
       {a?<div className="space-y-3 border-t border-[#edf0f1] bg-[#fafbfb] px-5 py-4">
        <p className="text-xs leading-5 text-[#73818e]">
          <strong>Source :</strong> {a.source_product_name||"Sans titre"}
          {" · "}Rapprochement par {a.matched_by==="ean"?"EAN":"nom du produit"}.
        </p>
        {a.source_product_url?<a href={a.source_product_url} rel="noopener noreferrer" target="_blank"
          className="inline-block break-all text-xs font-semibold text-[#245878] underline">Ouvrir la page officielle pour comparaison</a>:null}
        {a.image_review_status==="pending"?<div className="space-y-3 border-t pt-3">
          <form action={approveProductImageAction} className="space-y-2">
           <input type="hidden" name="product_id" value={p.id}/>
           <label className="block text-xs font-semibold text-[#567081]">
            Justificatif de vérification
            <input name="evidence" required minLength={5} maxLength={500}
             placeholder="EAN/format identique, contrôle visuel effectué"
             className="mt-1 w-full rounded-lg border bg-white p-3 text-sm"/>
           </label>
           <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-[#1b6244] px-4 py-2.5 text-xs font-bold text-white">Valider la photo</button>
           </div>
          </form>
          <form action={rejectProductImageAction}>
           <input type="hidden" name="product_id" value={p.id}/>
           <button className="rounded-lg border border-[#d9a59b] px-4 py-2.5 text-xs font-bold text-[#a24e38]">Rejeter et retirer le visuel</button>
          </form>
        </div>:null}
       </div>:null}
      </article>;
    })}
   </div>:<div className="rounded-xl border bg-white p-8 text-sm text-[#6b7d89]">Aucun produit correspondant à cette sélection.</div>}
   <p className="text-xs text-[#7c8a95]">Aucune action sur cet écran ne publie commercialement un produit. L'approbation du visuel ne remplace pas la vérification du tarif ni la conformité française.</p>
 </div>;
}
