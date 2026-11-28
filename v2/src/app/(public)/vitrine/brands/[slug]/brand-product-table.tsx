"use client";
import {useMemo,useState} from "react";
import Link from "next/link";

export type CatalogueProduct={
 id:string;name:string;sku:string|null;ean:string|null;format:string|null;category:string|null;price_ht:number|string|null;image_url:string|null;units_per_carton:number|null;
 description?:string|null;min_qty?:number;qty_step?:number;retail_ttc?:number|string|null;requestable?:boolean;tiers?:{paid:number;free:number;price_ht:number}[];
};
const observations:Record<string,{prices:number[];sources:string[]}> = {
 "8809416470009":{prices:[21.99],sources:["https://www.pharmacieeiffelcommerce.com/cosrx-advanced-snail-96-mucin-power-essence-a84633"]},
 "8809517414315":{prices:[18.99],sources:["https://perfumemarket.fr/products/medicube-zero-pore-pad-mild"]},
 "8809525249565":{prices:[21],sources:["https://pharmaciedesrochettes.fr/produit/beauty-of-joseon-dynasty-creme-hydratante-et-nourrissante-50ml"]},
 "8809937361718":{prices:[6.95],sources:["https://lapharmaciedepierre.fr/produit/biodance-bio-collagen-real-deep-mask-visage-masque-de-34g/"]},
 "8809447256221":{prices:[25.41],sources:["https://www.pharmaciepolygone.com/fr/products/dr-althea-345-gel-creme-hydratante-niacinamide-et-panthenol-50ml"]},
};
const euro=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"});
const money=(n:number)=>euro.format(n);
const valid=(v:unknown)=>Number(v)>0&&Number.isFinite(Number(v));
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function quote(p:CatalogueProduct,qty:number){
 const tier=[...(p.tiers??[])].filter(t=>t.paid<=qty&&t.paid>0&&valid(t.price_ht)&&(!t.free||qty%t.paid===0)).sort((a,b)=>b.paid-a.paid||b.free-a.free)[0];
 const unit=tier?Number(tier.price_ht):Number(p.price_ht)||0;
 const free=tier?.free?Math.floor(qty/tier.paid)*tier.free:0;
 return {unit,free,total:unit*qty,net:qty?unit*qty/(qty+free):unit};
}
export function BrandProductTable({products,slug=""}:{products:CatalogueProduct[];slug?:string}){
 const [search,setSearch]=useState(""),[category,setCategory]=useState(""),[sort,setSort]=useState("name"),[view,setView]=useState<"grid"|"list">("grid"),[quantities,setQuantities]=useState<Record<string,number>>({}),[onlySelected,setOnlySelected]=useState(false),[coef,setCoef]=useState(2);
 const categories=useMemo(()=>Array.from(new Set(products.map(p=>p.category||"Autres références"))).sort(),[products]);
 const items=useMemo(()=>products.filter(p=>(!category||(p.category||"Autres références")===category)&&(!onlySelected||quantities[p.id]>0)&&normalize([p.name,p.ean,p.sku,p.format].filter(Boolean).join(" ")).includes(normalize(search))).sort((a,b)=>sort==="price"?Number(a.price_ht)-Number(b.price_ht):sort==="price-desc"?Number(b.price_ht)-Number(a.price_ht):a.name.localeCompare(b.name,"fr")),[products,search,category,sort,onlySelected,quantities]);
 const chosen=products.filter(p=>p.requestable!==false&&quantities[p.id]>0);
 const totals=chosen.reduce((s,p)=>{const q=quantities[p.id];const v=quote(p,q);return {cost:s.cost+v.total,units:s.units+q,free:s.free+v.free};},{cost:0,units:0,free:0});
 const change=(p:CatalogueProduct,delta:number)=>setQuantities(old=>{const q=old[p.id]||0;const step=Math.max(1,p.qty_step||1),min=Math.max(1,p.min_qty||1);return {...old,[p.id]:delta>0?(q?q+step:min):q<=min?0:Math.max(min,q-step)};});
 const note=chosen.map(p=>p.name+" × "+quantities[p.id]+(quote(p,quantities[p.id]).free?" (+"+quote(p,quantities[p.id]).free+" UG)":"")).join("\n");
 const requestHref="/vitrine?marque="+encodeURIComponent(slug)+"&projet="+encodeURIComponent(("Projet d'implantation indicatif :\n"+note+"\nBudget HT estimé : "+money(totals.cost)).slice(0,1500))+"#contact";
 return <div className="mt-5 space-y-5">
  <div className="rounded-2xl border border-[#dce4df] bg-white p-4 shadow-sm">
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
    <label className="grid gap-1 text-xs font-bold">Rechercher un produit ou EAN<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, EAN, format…" className="min-h-12 rounded-xl border border-[#dce4df] px-3 text-sm font-normal"/></label>
    <label className="grid gap-1 text-xs font-bold">Famille<select value={category} onChange={e=>setCategory(e.target.value)} className="min-h-12 rounded-xl border border-[#dce4df] bg-white px-3 text-sm font-normal"><option value="">Toutes</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-bold">Trier<select value={sort} onChange={e=>setSort(e.target.value)} className="min-h-12 rounded-xl border border-[#dce4df] bg-white px-3 text-sm font-normal"><option value="name">Nom A–Z</option><option value="price">Prix croissant</option><option value="price-desc">Prix décroissant</option></select></label>
    <div className="flex items-end gap-1"><button type="button" aria-pressed={view==="grid"} onClick={()=>setView("grid")} className={"min-h-12 rounded-xl px-4 text-xs font-bold "+(view==="grid"?"bg-[#142941] text-white":"border")}>Visuels</button><button type="button" aria-pressed={view==="list"} onClick={()=>setView("list")} className={"min-h-12 rounded-xl px-4 text-xs font-bold "+(view==="list"?"bg-[#142941] text-white":"border")}>Liste</button></div>
   </div>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-[#526a76]"><span>{items.length} / {products.length} références</span><label className="flex items-center gap-2"><input type="checkbox" checked={onlySelected} onChange={e=>setOnlySelected(e.target.checked)}/> Ma sélection ({chosen.length})</label><label className="flex items-center gap-2">Coefficient simulé <select value={coef} onChange={e=>setCoef(Number(e.target.value))} className="rounded-lg border bg-white p-2">{[1.5,1.6,1.8,2,2.2,2.5,3].map(c=><option key={c} value={c}>× {c.toFixed(2)}</option>)}</select></label></div>
   <p className="mt-2 text-[11px] leading-5 text-[#64747c]">Coefficient = prix de vente TTC / prix d'achat HT net. Les simulations ne sont pas des prix constatés. Les prix conseillés et observés sont non contraignants.</p>
  </div>
  <div className={view==="grid"?"grid gap-4 sm:grid-cols-2 xl:grid-cols-3":"grid gap-2"}>
   {items.map(p=>{const q=quantities[p.id]||0;const v=quote(p,q||Math.max(1,p.min_qty||1));const obs=p.ean?observations[p.ean]:undefined;const observed=obs?obs.prices.reduce((a,b)=>a+b,0)/obs.prices.length:0;const retail=valid(p.retail_ttc)?Number(p.retail_ttc):observed;const blocked=p.requestable===false;return <article key={p.id} className={"overflow-hidden rounded-2xl border bg-white p-4 "+(q?"border-[#789b8d] ring-1 ring-[#789b8d]":"border-[#e2e5e1]")+(view==="list"?" sm:grid sm:grid-cols-[72px_1.6fr_1fr_auto] sm:items-center sm:gap-4":"")}>
    <div className={"flex items-center justify-center overflow-hidden rounded-xl bg-[#f5f5f0] "+(view==="grid"?"h-40":"h-16")}>{p.image_url?<img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-contain p-2" onError={e=>{e.currentTarget.style.display="none"}}/>:<span className="text-[11px] text-[#73818a]">Visuel non disponible</span>}</div>
    <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9c6949]">{p.category||"Assortiment"}</p><h3 className="mt-1 text-sm font-extrabold leading-snug">{p.name}</h3><p className="mt-1 text-xs text-[#64747c]">{[p.format,p.ean||p.sku].filter(Boolean).join(" · ")}</p>{p.description&&<details className="mt-2 text-xs text-[#64747c]"><summary className="cursor-pointer font-bold">Fiche produit</summary><p className="mt-2 whitespace-pre-line leading-5">{p.description}</p></details>}{blocked&&<p className="mt-2 text-xs font-bold text-[#8b6345]">Hors sélection d'implantation</p>}</div>
    <div className="mt-3 space-y-2 rounded-xl bg-[#f7f8f5] p-3 text-xs"><div className="flex justify-between gap-2"><span>Achat HT indicatif</span><strong>{valid(p.price_ht)?money(v.unit):"Sur devis"}</strong></div>{v.free>0&&<div className="flex justify-between"><span>Net HT / unité avec UG</span><strong>{money(v.net)}</strong></div>}{retail>0?<><div className="flex justify-between gap-2"><span>{valid(p.retail_ttc)?"PVC conseillé TTC":"Prix public relevé TTC"}</span><strong>{money(retail)}</strong></div><div className="flex justify-between gap-2"><span>Coefficient indicatif</span><strong className="text-[#31576a]">× {v.net>0?(retail/v.net).toFixed(2):"—"}</strong></div>{!valid(p.retail_ttc)&&obs&&<a href={obs.sources[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] underline">Source du prix public (relevé web)</a>}</>:<div className="flex justify-between gap-2"><span>PV TTC simulé (× {coef})</span><strong>{v.net>0?money(v.net*coef):"—"}</strong></div>}{!!p.tiers?.length&&<details className="border-t pt-2"><summary className="cursor-pointer font-bold">Paliers & unités offertes</summary>{p.tiers.map((t,i)=><div key={i} className="mt-1 flex justify-between"><span>{t.paid} u. {t.free?"+ "+t.free+" UG":""}</span><span>{money(Number(t.price_ht))} HT</span></div>)}</details>}</div>
    <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[11px] text-[#64747c]">{p.units_per_carton?"Carton : "+p.units_per_carton:"Min. "+(p.min_qty||1)+" u."}</span>{!blocked&&valid(p.price_ht)&&<div className="flex items-center gap-2"><button type="button" aria-label={"Retirer "+p.name} onClick={()=>change(p,-1)} disabled={!q} className="h-10 w-10 rounded-lg border text-lg disabled:opacity-30">−</button><span className="min-w-6 text-center text-sm font-bold">{q}</span><button type="button" aria-label={"Ajouter "+p.name} onClick={()=>change(p,1)} className="h-10 w-10 rounded-lg bg-[#142941] text-xl text-white">+</button></div>}</div>
   </article>})}
  </div>
  {!items.length&&<div className="rounded-xl border bg-white p-8 text-center text-sm">Aucune référence ne correspond à votre recherche. <button type="button" onClick={()=>{setSearch("");setCategory("");setOnlySelected(false)}} className="font-bold underline">Réinitialiser</button></div>}
  {chosen.length>0&&<div className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#142941] p-4 text-white shadow-xl"><div><p className="text-xs text-white/80">{chosen.length} références · {totals.units} unités {totals.free?"+ "+totals.free+" UG":""}</p><p className="text-xl font-bold">{money(totals.cost)} HT <span className="text-xs font-normal text-white/70">estimé</span></p></div><Link href={requestHref} className="rounded-full bg-[#edc197] px-5 py-3 text-sm font-bold text-[#142941]">Demander mon implantation</Link></div>}
 </div>;
}
