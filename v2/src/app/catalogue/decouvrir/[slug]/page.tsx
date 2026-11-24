import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft,BookOpen,Info,Package,ShieldAlert} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";
import {loadPharmacyImplantationOffers,implantationEuro} from "@/lib/implantation-offers";
import {requestSpecificImplantationOfferAction} from "../offre-actions";
import {requestBrandIntroductionAction} from "../actions";

export default async function BrandImplantationDetails({params}:{
 params:Promise<{slug:string}>
}) {
 const {slug}=await params;
 const [{brands},offers]=await Promise.all([
   loadPharmacyBrandDirectory(),loadPharmacyImplantationOffers()
 ]);
 const brand=brands.find(b=>b.slug===slug&&b.status!=="implanted");
 if(!brand)notFound();
 const list=offers.filter(o=>o.brand_id===brand.brand_id);
 return <div className="space-y-6 pb-14">
   <nav aria-label="Fil d'Ariane" className="text-xs text-[#71808a]">
     <Link href="/catalogue" className="hover:underline">Espace officine</Link>
     <span className="mx-2">/</span>
     <Link href="/catalogue/decouvrir" className="hover:underline">Découvrir des marques</Link>
     <span className="mx-2">/</span><span className="font-bold text-[#142941]">{brand.name}</span>
   </nav>
   <header className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9">
     <p className="text-xs font-bold uppercase tracking-widest text-[#edbd91]">Propositions de référencement</p>
     <h1 className="mt-2 text-3xl font-extrabold">Implanter {brand.name}</h1>
     <p className="mt-3 max-w-3xl text-sm leading-6 text-[#dbe4e9]">{brand.description||"Découvrez les conditions de présentation de la marque."}</p>
     <p className="mt-3 text-xs text-[#bcd0da]">{list.length} offre(s) ou palier(s) documenté(s) pour ce pilote</p>
   </header>
   <Link href="/catalogue/decouvrir" className="inline-flex items-center gap-2 text-sm font-semibold text-[#245c78] hover:underline"><ArrowLeft size={16}/> Toutes les marques</Link>
   <div className="rounded-xl border border-[#eadcc4] bg-[#fff9ee] p-5 text-sm leading-6 text-[#79532f]">
     <strong>TR1 est votre interlocuteur commercial, pas le vendeur.</strong>
     <p className="mt-2">Les offres de démonstration sont issues d'anciens documents fournisseur : elles ne sont pas encore confirmées. Une demande de présentation est sans engagement et n'envoie pas de commande.</p>
     {brand.slug==="noto"?<p className="mt-2 flex gap-2 text-xs"><ShieldAlert size={17} className="shrink-0"/>Les produits contenant des cannabinoïdes nécessitent un examen réglementaire distinct : aucune offre de vente correspondante n'est proposée.</p>:null}
   </div>
   {brand.showroom_available&&brand.demo_access?
     <Link href={"/catalogue/althesia?marque="+brand.slug} className="inline-flex items-center gap-2 rounded-lg border border-[#d5e0e5] bg-white px-5 py-3 text-sm font-semibold text-[#214e6d]">
       <BookOpen size={17}/> Consulter les fiches documentaires {brand.name}
     </Link>:null}
   <section>
     <div className="mb-4">
       <h2 className="text-xl font-bold text-[#142941]">Conditions d'implantation</h2>
       <p className="mt-1 text-sm text-[#71808a]">Comparez les minimums, les unités offertes et les services de lancement avant d'exprimer votre intérêt.</p>
     </div>
     {list.length?<div className="grid gap-4 lg:grid-cols-2">
       {list.map(o=><article key={o.id} className="flex flex-col rounded-xl border border-[#dce5e8] bg-white p-6">
         <div className="flex items-start justify-between gap-3">
           <div>
             <p className="text-xs font-bold uppercase tracking-widest text-[#6e7f8c]">
               {o.offer_kind==="fixed_pack"?"Pack de démarrage":o.offer_kind==="quantity_tier"?"Palier de commande":"Sélection libre"}
             </p>
             <h3 className="mt-2 text-xl font-extrabold text-[#142941]">{o.title}</h3>
           </div>
           <span className="rounded-md bg-[#fff3e2] px-2.5 py-1.5 text-[11px] font-bold text-[#8c552d]">
             {o.verification_status==="verified"?"Conditions vérifiées":"À confirmer"}
           </span>
         </div>
         {o.summary?<p className="mt-3 text-sm leading-6 text-[#687986]">{o.summary}</p>:null}
         <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg bg-[#f5f8f9] p-4 text-xs">
           <div><dt className="text-[#7d8b95]">Références distinctes min.</dt>
             <dd className="mt-1 text-base font-bold text-[#142941]">{o.min_distinct_references??"À confirmer"}</dd></div>
           <div><dt className="text-[#7d8b95]">Unités payées / réf.</dt>
             <dd className="mt-1 text-base font-bold text-[#142941]">{o.min_units_per_reference??"À confirmer"}</dd></div>
           <div><dt className="text-[#7d8b95]">UG / référence</dt>
             <dd className="mt-1 text-base font-bold text-[#142941]">{o.free_units_per_reference||"Aucune indiquée"}</dd></div>
           <div><dt className="text-[#7d8b95]">Minimum HT</dt>
             <dd className="mt-1 text-base font-bold text-[#142941]">{implantationEuro(o.min_order_ht)}</dd></div>
           <div><dt className="text-[#7d8b95]">Minimum total d'unités</dt>
             <dd className="mt-1 font-bold text-[#142941]">{o.min_total_paid_units??"À confirmer"}</dd></div>
           <div><dt className="text-[#7d8b95]">Prix pack HT</dt>
             <dd className="mt-1 font-bold text-[#142941]">{implantationEuro(o.fixed_pack_ht)}</dd></div>
         </dl>
         {o.discount_pct!==null?<p className="mt-3 text-sm font-semibold text-[#2d596f]">Remise indiquée : {o.discount_pct} %</p>:null}
         {o.lines.length?<div className="mt-4">
           <h4 className="text-sm font-bold">Composition du pack</h4>
           <div className="mt-2 divide-y rounded-lg border">
             {o.lines.map((line,i)=><p key={i} className="flex flex-wrap justify-between gap-3 px-3 py-2 text-xs">
               <span>{line.product_name}</span><strong>{line.paid_units} u. + {line.free_units} UG</strong>
             </p>)}
           </div>
         </div>:null}
         {[
           ["Conditions / exclus",o.offer_conditions],
           ["Mise en avant / PLV",o.plv_commitment],
           ["Formation / animation",o.training_commitment],
           ["Transport / franco",o.shipping_terms],
         ].some(([,v])=>!!v)?<div className="mt-4 space-y-2 border-t pt-4">
           {[
             ["Conditions et exclusions",o.offer_conditions],
             ["Mise en avant / PLV",o.plv_commitment],
             ["Formation / animation",o.training_commitment],
             ["Transport / franco",o.shipping_terms],
           ].filter(([,v])=>!!v).map(([label,value])=><p key={label} className="text-xs leading-5">
             <strong className="text-[#395a71]">{label} :</strong> {value}
           </p>)}
         </div>:null}
         <div className="mt-auto pt-5">
           <form action={requestSpecificImplantationOfferAction} className="space-y-2 border-t pt-4">
             <input name="offer_id" type="hidden" value={o.id}/>
             <label className="block text-xs font-semibold text-[#5e7482]">Question / précision facultative
               <input name="note" maxLength={800} className="mt-1 w-full rounded-lg border p-3 text-sm"
                 placeholder="Par exemple : rendez-vous de présentation"/>
             </label>
             <button className="w-full rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">
               Demander cette offre à TR1
             </button>
           </form>
           <p className="mt-2 text-[11px] leading-5 text-[#7b8791]">Demande d'information seulement ; aucun bon de commande créé.</p>
         </div>
       </article>)}
     </div>:<div className="rounded-xl border bg-white p-6">
       <h3 className="flex items-center gap-2 text-lg font-bold"><Info size={18}/> Conditions à construire</h3>
       <p className="mt-2 text-sm leading-6 text-[#71808c]">Les packs, minimums et unités gratuites n'ont pas encore été confirmés par le fournisseur pour cette marque.</p>
       <form action={requestBrandIntroductionAction} className="mt-4 max-w-md space-y-3">
         <input name="brand_id" type="hidden" value={brand.brand_id}/>
         <label className="block text-xs font-semibold">Votre question
           <input name="note" maxLength={800} placeholder="Recevoir les conditions de référencement"
             className="mt-1 w-full rounded-lg border p-3 text-sm"/>
         </label>
         <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Demander une présentation</button>
       </form>
     </div>}
   </section>
 </div>;
}
