"use client";
import {useState} from "react";
import {requestSupplierEstimate} from "@/app/supplier-estimate-actions";
export type SupplierEstimate={id:string;name:string;ean:string;brand:string;brand_id:string;offers:{paid:number;free:number;price_ht:number|string}[]};
const euro=(n:number)=>n.toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
export function SupplierEstimates({estimates,token,email,result}:{estimates:SupplierEstimate[];token:string;email:string;result:string}){
 const brands=[...new Map(estimates.map(p=>[p.brand_id,p.brand])).entries()];
 const [brand,setBrand]=useState(brands[0]?.[0]??"");
 const [selection,setSelection]=useState<Record<string,string>>({});
 const rows=estimates.filter(p=>p.brand_id===brand);
 const chosen=rows.flatMap(p=>{const o=p.offers.find(o=>String(o.paid)===selection[p.id]);return o?[{p,o}]:[];});
 const total=chosen.reduce((s,{o})=>s+o.paid*Number(o.price_ht),0);
 const [note,setNote]=useState("");
 const message=chosen.map(({p,o})=>p.name+" · "+o.paid+" achetées"+(o.free?" + "+o.free+" offertes":"")+" · "+euro(Number(o.price_ht))+" HT/u.").join("\n")+(note?"\n"+note:"");
 return <section id="devis" className="mt-8 scroll-mt-24 rounded-2xl border bg-white p-5 sm:p-7 space-y-5">
 <header><p className="text-xs font-bold uppercase tracking-wider text-[#9b5d2e]">Présentation commerciale · sur invitation</p><h2 className="mt-1 text-2xl font-extrabold">Préparer un devis</h2><p className="mt-2 text-sm text-[#69717d]">Tarifs indicatifs extraits des catalogues fournisseurs de septembre 2026. Les références, conditions, disponibilités et conformité doivent être confirmées par TR1 et le fournisseur. Aucune commande ni activation de compte à ce stade. Les tarifs ne tiennent pas compte de conditions personnalisées supplémentaires.</p></header>
 {result==="ok"&&<p role="status" className="rounded-lg bg-green-50 p-4 text-sm font-bold text-green-800">Votre demande de devis a été enregistrée. TR1 vous recontactera.</p>}{result==="erreur"&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Demande non enregistrée. Vérifiez l’adresse e-mail autorisée ou contactez TR1.</p>}
 <label className="grid gap-1 text-xs font-semibold">Marque<select value={brand} onChange={e=>setBrand(e.target.value)} className="rounded-lg border bg-white p-3 text-sm">{brands.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <div className="grid gap-3 sm:grid-cols-2">{rows.map(p=><article key={p.id} className="rounded-xl border p-4"><p className="text-xs text-[#69717d]">{p.brand} · {p.ean}</p><h3 className="mt-1 font-bold">{p.name}</h3><label className="mt-3 grid gap-1 text-xs font-semibold">Palier indicatif<select value={selection[p.id]??""} onChange={e=>setSelection(s=>({...s,[p.id]:e.target.value}))} className="rounded-lg border bg-white p-3 text-sm"><option value="">Ne pas sélectionner</option>{p.offers.map(o=><option key={o.paid+"-"+o.free} value={String(o.paid)}>{o.paid} u.{o.free?" + "+o.free+" UG":""} · {euro(Number(o.price_ht))} HT/u.</option>)}</select></label></article>)}</div>
 <div className="flex justify-between rounded-lg bg-[#f5f8f8] p-4 text-sm"><span>Estimation HT, hors conditions complémentaires</span><strong>{euro(total)}</strong></div>
 <form action={requestSupplierEstimate} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="token" value={token}/><input type="hidden" name="brand_id" value={brand}/><input type="hidden" name="note" value={message}/><div className="absolute -left-[10000px]" aria-hidden="true"><input name="website" tabIndex={-1}/></div>
 <label className="grid gap-1 text-xs font-semibold">Nom du contact<input name="contact" required minLength={2} maxLength={120} autoComplete="name" className="rounded-lg border p-3 text-sm"/></label><label className="grid gap-1 text-xs font-semibold">E-mail professionnel autorisé<input name="email" type="email" required maxLength={254} defaultValue={email} autoComplete="email" className="rounded-lg border p-3 text-sm"/></label><label className="grid gap-1 text-xs font-semibold sm:col-span-2">Précisions (facultatif)<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={2} className="rounded-lg border p-3 text-sm"/></label><button disabled={!chosen.length} className="rounded-lg bg-[#142941] p-3 text-sm font-bold text-white disabled:opacity-40 sm:col-span-2">Demander mon devis à TR1</button></form>
 </section>;
}
