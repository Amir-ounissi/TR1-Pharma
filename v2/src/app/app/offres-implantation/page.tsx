import Link from "next/link";
import {requireOwner} from "@/lib/auth";
import {saveImplantationOfferAction,confirmImplantationOfferAction,addImplantationPackLineAction,removeImplantationPackLineAction} from "./actions";

type Offer = {
 id:string;brand_id:string;title:string;offer_kind:string;summary:string|null;
 min_distinct_references:number|null;min_units_per_reference:number|null;
 free_units_per_reference:number;min_total_paid_units:number|null;
 min_order_ht:number|null;fixed_pack_ht:number|null;discount_pct:number|null;
 offer_conditions:string|null;plv_commitment:string|null;training_commitment:string|null;
 shipping_terms:string|null;source_reference:string|null;confirmation_reference:string|null;
 verification_status:string;pilot_visible:boolean;published:boolean;
 valid_from:string|null;valid_until:string|null;
};
type Brand = {id:string;name:string;slug:string};
function OfferEditor({offer,brands,selectedBrandId}: {offer?:Offer;brands:Brand[];selectedBrandId?:string}) {
 const field=(label:string,name:string,opts?:{number?:boolean;integer?:boolean;placeholder?:string})=>
 <label className="grid gap-1 text-xs font-semibold text-[#536b7d]" key={name}>
   {label}
   <input name={name} type={opts?.number?"number":"text"}
     min={opts?.number?"0":undefined} step={opts?.number?(opts.integer?"1":"0.01"):undefined}
     defaultValue={offer?String((offer as unknown as Record<string,unknown>)[name]??""):""}
     placeholder={opts?.placeholder} className="rounded-lg border border-[#dce4e8] bg-white p-2.5 text-sm text-[#142941]"/>
 </label>;
 return <form action={saveImplantationOfferAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {offer?<input type="hidden" name="offer_id" value={offer.id}/>:null}
   <label className="grid gap-1 text-xs font-semibold">Marque
     <select name="brand_id" defaultValue={offer?.brand_id??selectedBrandId??""}
       className="rounded-lg border bg-white p-2.5 text-sm" required>
       <option value="">Sélectionner</option>
       {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
   </label>
   {field("Nom de l'offre","title",{placeholder:"Ex. Pack lancement 6 références"})}
   <label className="grid gap-1 text-xs font-semibold">Type
     <select name="offer_kind" defaultValue={offer?.offer_kind??"flexible"}
       className="rounded-lg border bg-white p-2.5 text-sm">
       <option value="flexible">Sélection libre</option>
       <option value="quantity_tier">Palier de quantité / UG</option>
       <option value="fixed_pack">Pack fixe avec références imposées</option>
     </select>
   </label>
   {field("Minimum de références différentes","min_distinct_references",{number:true,integer:true,placeholder:"Non indiqué = à confirmer"})}
   {field("Unités payantes / référence","min_units_per_reference",{number:true,integer:true})}
   {field("Unités offertes / référence","free_units_per_reference",{number:true,integer:true,placeholder:"0"})}
   {field("Minimum total d'unités payantes","min_total_paid_units",{number:true,integer:true})}
   {field("Minimum de commande (€ HT)","min_order_ht",{number:true})}
   {field("Prix global du pack fixe (€ HT)","fixed_pack_ht",{number:true})}
   {field("Remise éventuelle (%)","discount_pct",{number:true})}
   {field("Source (catalogue ou contrat)","source_reference",{placeholder:"Catalogue fournisseur, page..."})}
   {field("Référence de confirmation fournisseur","confirmation_reference",{placeholder:"Email, avenant, devis validé..."})}
   <label className="grid gap-1 text-xs font-semibold">Valable à partir du
     <input name="valid_from" type="date" defaultValue={offer?.valid_from??""}
       className="rounded-lg border p-2.5 text-sm"/>
   </label>
   <label className="grid gap-1 text-xs font-semibold">Valable jusqu'au
     <input name="valid_until" type="date" defaultValue={offer?.valid_until??""}
       className="rounded-lg border p-2.5 text-sm"/>
   </label>
   {[
     ["Présentation / positionnement","summary"],
     ["Conditions et exclusions","offer_conditions"],
     ["PLV ou mise en avant requise","plv_commitment"],
     ["Formation et animation","training_commitment"],
     ["Transport / franco / livraison","shipping_terms"],
   ].map(([label,name])=><label key={name} className="grid gap-1 text-xs font-semibold sm:col-span-2 xl:col-span-3">
     {label}
     <textarea name={name} rows={2}
       defaultValue={offer?String((offer as unknown as Record<string,unknown>)[name]??""):""}
       className="rounded-lg border bg-white p-2.5 text-sm"/>
   </label>)}
   <label className="flex items-start gap-2 text-xs font-semibold sm:col-span-2 xl:col-span-3">
     <input type="checkbox" name="pilot_visible" value="yes" defaultChecked={offer?.pilot_visible??false}
       className="mt-0.5"/>
     Afficher dans le pilote pharmacie (indiqué comme non confirmé, sans permettre une commande)
   </label>
   <button type="submit" className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white sm:col-span-2 xl:col-span-3">
     {offer?"Enregistrer les modifications — repasse en brouillon":"Créer l'offre en brouillon"}
   </button>
 </form>;
}

export default async function OffersAdmin({searchParams}:{
 searchParams:Promise<{marque?:string;sauvegarde?:string;validee?:string;ligne?:string}>
}) {
 const {db}=await requireOwner();
 const q=await searchParams;
 const [brandsResult,offersResult,linesResult,productsResult]=await Promise.all([
   db.from("brands").select("id,name,slug").order("name"),
   db.from("brand_implantation_offers").select("*").order("created_at",{ascending:true}),
   db.from("brand_implantation_offer_lines").select("offer_id,product_id,paid_units,free_units,line_note"),
   db.from("products").select("id,brand_id,name,sku").order("name").limit(500),
 ]);
 if(brandsResult.error||offersResult.error||linesResult.error||productsResult.error)
   throw new Error("Impossible de charger les offres d'implantation.");
 const brands=brandsResult.data??[],offers=(offersResult.data??[]) as Offer[],
   lines=linesResult.data??[],products=productsResult.data??[];
 const slug=brands.find(b=>b.slug===q.marque)?.slug;
 const selectedId=brands.find(b=>b.slug===slug)?.id;
 const listed=offers.filter(o=>!selectedId||o.brand_id===selectedId);
 const byBrand=(id:string)=>brands.find(b=>b.id===id);
 const productName=(id:string)=>products.find(p=>p.id===id)?.name||"Référence";
 return <div className="space-y-7 pb-12">
   <header>
     <p className="text-xs font-bold uppercase tracking-widest text-[#a35c2c]">TR1 PHARMA · Conditions fournisseur</p>
     <h1 className="mt-2 text-3xl font-extrabold">Offres et packs d'implantation</h1>
     {slug?<Link href={"/app/marques/"+selectedId+"?onglet=implantation"}
       className="mt-3 inline-block text-sm font-bold text-[#225674] underline">Retour à la fiche {brands.find(b=>b.id===selectedId)?.name}</Link>:null}
     <p className="mt-2 max-w-4xl text-sm leading-6 text-[#697b88]">
       Gère séparément chaque proposition : packs libres ou imposés, minimum de références,
       quantités, UG, prix, PLV, formations et franco. Le statut d'implantation d'une pharmacie
       et la rémunération de TR1 sont indépendants de ces offres.
     </p>
   </header>
   {q.sauvegarde==="1"||q.validee==="1"||q.ligne==="1"?<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">Modification enregistrée en V2.</p>:null}
   <div className="grid gap-3 sm:grid-cols-3">
     {[
       ["Offres configurées",offers.length],
       ["Scénarios à confirmer",offers.filter(x=>x.verification_status!=="verified").length],
       ["Offres officiellement publiées",offers.filter(x=>x.published).length],
     ].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-5">
       <p className="text-xs font-semibold text-[#71808a]">{label}</p>
       <p className="mt-3 text-3xl font-extrabold">{value}</p>
     </div>)}
   </div>
   <section className="rounded-xl border border-[#eadfc9] bg-[#fff9ee] p-5 text-sm leading-6 text-[#82562c]">
     <strong>Règle métier :</strong> un palier de réassort (3, 6, 12, 24 unités) n'est pas
     automatiquement un pack d'implantation. Les 8 offres historiques préremplies sont des
     scénarios de test ; le nombre minimum de références reste à confirmer lorsqu'il n'est pas documenté.
     Aucune offre n'est publiée commercialement sans preuve de confirmation fournisseur.
   </section>
   <section className="rounded-xl border bg-white p-6">
     <h2 className="text-xl font-bold">Ajouter une nouvelle offre de marque</h2>
     <p className="my-3 text-sm text-[#6a7b87]">Utilise « Pack fixe » lorsqu'une sélection précise de références est imposée. Tu ajouteras ensuite chaque ligne du pack.</p>
     <OfferEditor brands={brands} selectedBrandId={selectedId}/>
   </section>
   <div className="flex flex-wrap items-center justify-between gap-3">
     <h2 className="text-xl font-bold">Offres existantes</h2>
     <nav className="flex flex-wrap gap-2">
       <Link href="/app/offres-implantation" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Toutes</Link>
       {brands.map(b=><Link key={b.id} href={"/app/offres-implantation?marque="+b.slug}
         className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">{b.name}</Link>)}
     </nav>
   </div>
   {listed.length?listed.map(o=>{
     const ownLines=lines.filter(x=>x.offer_id===o.id);
     const choices=products.filter(p=>p.brand_id===o.brand_id);
     return <section key={o.id} className="rounded-xl border bg-white">
       <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#f7f9fa] p-5">
         <div><p className="text-xs font-bold uppercase tracking-wide text-[#667b8b]">{byBrand(o.brand_id)?.name}</p>
           <h3 className="mt-1 text-xl font-bold">{o.title}</h3>
           <p className="mt-1 text-xs text-[#71828d]">{o.offer_kind==="fixed_pack"?"Pack fixe":o.offer_kind==="quantity_tier"?"Palier fournisseur":"Sélection libre"} · {o.pilot_visible?"Visible en pilote":"Masqué du pilote"}</p>
         </div>
         <span className={"rounded-lg px-3 py-2 text-xs font-bold "+(o.published?"bg-green-100 text-green-800":"bg-[#fff2dd] text-[#905521]")}>
           {o.published?"Offre vérifiée et publiée":o.verification_status==="verified"?"Confirmée non publiée":"À confirmer"}
         </span>
       </div>
       <details className="p-5" open={false}>
         <summary className="cursor-pointer text-sm font-bold text-[#244c68]">Modifier l'offre et ses conditions</summary>
         <div className="mt-5"><OfferEditor offer={o} brands={brands}/></div>
       </details>
       <div className="border-t p-5">
         <h4 className="font-semibold">Références imposées dans le pack ({ownLines.length})</h4>
         <p className="mt-1 text-xs text-[#70808d]">À renseigner seulement pour les packs fixes ou les offres avec sélection obligatoire.</p>
         {ownLines.length?<div className="mt-3 divide-y rounded-lg border">
           {ownLines.map(line=><div key={line.product_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
             <div><strong>{productName(line.product_id)}</strong>
               <p className="mt-1 text-xs text-[#73818e]">{line.paid_units} payées + {line.free_units} UG</p></div>
             {!o.published?<form action={removeImplantationPackLineAction}>
               <input type="hidden" name="offer_id" value={o.id}/>
               <input type="hidden" name="product_id" value={line.product_id}/>
               <button className="text-xs font-semibold text-[#a44f27] underline">Retirer</button>
             </form>:null}
           </div>)}
         </div>:<p className="mt-3 text-xs text-[#80909c]">Aucune référence obligatoire renseignée.</p>}
         {!o.published?<form action={addImplantationPackLineAction} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_90px_auto]">
           <input type="hidden" name="offer_id" value={o.id}/>
           <select name="product_id" required className="min-w-0 rounded-lg border bg-white p-2.5 text-sm">
             <option value="">Choisir une référence de {byBrand(o.brand_id)?.name}</option>
             {choices.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
           <label className="grid gap-1 text-xs font-semibold">Payées
             <input name="paid_units" type="number" min={1} defaultValue={6} required className="w-full rounded-lg border p-2.5 text-sm"/></label>
           <label className="grid gap-1 text-xs font-semibold">UG
             <input name="free_units" type="number" min={0} defaultValue={0} required className="w-full rounded-lg border p-2.5 text-sm"/></label>
           <button className="self-end rounded-lg border border-[#142941] px-4 py-3 text-xs font-bold">Ajouter / modifier</button>
         </form>:null}
       </div>
       <div className="border-t bg-[#fbfcfc] p-5">
         <h4 className="text-sm font-bold">Confirmer avec le fournisseur</h4>
         <p className="mt-2 text-xs text-[#71818c]">La publication demande un justificatif, une source et les composants d'un pack fixe. Les prix non vérifiés ne doivent pas être présentés comme définitifs.</p>
         <form action={confirmImplantationOfferAction} className="mt-3 flex flex-wrap items-end gap-3">
           <input type="hidden" name="offer_id" value={o.id}/>
           <label className="min-w-48 flex-1 text-xs font-semibold">Confirmation écrite
             <input name="confirmation_reference" defaultValue={o.confirmation_reference??""}
               placeholder="Contrat, email, devis signé…" required minLength={6}
               className="mt-1 w-full rounded-lg border bg-white p-3 text-sm"/></label>
           <label className="flex items-center gap-2 text-xs font-semibold">
             <input type="checkbox" name="publish" value="yes" defaultChecked={o.published}/> Publier l'offre validée
           </label>
           <button className="rounded-lg bg-[#142941] px-5 py-3 text-xs font-bold text-white">Valider</button>
         </form>
       </div>
     </section>;
   }):<p className="rounded-xl border bg-white p-6 text-sm text-[#7a8790]">Aucune offre d'implantation pour cette sélection.</p>}
   <div className="flex flex-wrap gap-4 text-sm">
     <Link href="/app/implantations" className="font-semibold underline">Implantations par pharmacie</Link>
     <Link href="/app/commissions" className="font-semibold underline">Commissions et primes TR1</Link>
   </div>
 </div>;
}
