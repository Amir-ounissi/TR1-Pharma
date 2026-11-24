import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { addRevenueEntry,advanceRevenueEntry } from "./actions";
const types:Record<string,string>={commission:"Commission",implantation:"Prime d'implantation",animation:"Animation",formation:"Formation",forfait:"Forfait",other:"Autre prestation"};
const states:Record<string,string>={estimated:"Estimée",acquired:"Acquise",invoiced:"Facturée",paid:"Encaissée",cancelled:"Annulée"};
const stages=["estimated","acquired","invoiced","paid"];
const money=(v:number)=>v.toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
const field="w-full rounded-lg border bg-white p-2.5 text-sm";
const label="grid gap-1 text-xs font-semibold";
export default async function Register({searchParams}:{searchParams:Promise<{ok?:string;erreur?:string}>}){
 const {db}=await requireOwner();const params=await searchParams;
 const [entries,brands,pharmacies]=await Promise.all([db.from("tr1_revenue_entries").select("*",{count:"exact"}).order("event_date",{ascending:false}).order("created_at",{ascending:false}).limit(100),db.from("brands").select("id,name").order("name"),db.from("pharmacies").select("id,name,city").order("name").limit(1000)]);
 if(entries.error||brands.error||pharmacies.error)throw new Error("Impossible de charger le registre financier.");
 const rows=entries.data??[],bs=brands.data??[],ps=pharmacies.data??[];
 const total=(status:string,brand?:string)=>rows.filter(r=>r.status===status&&(!brand||r.brand_id===brand)).reduce((n,r)=>n+Math.round(Number(r.amount_ht)*100),0)/100;
 const errors:Record<string,string>={doublon:"Référence déjà enregistrée pour cette marque et cette catégorie.",creation:"Enregistrement refusé. Vérifier les champs.",transition:"Transition refusée : vérifier le statut, les dates et les justificatifs."};
 return <div className="space-y-6 pb-12">
 <header><Link href="/app/revenus" className="text-sm font-semibold underline">Retour aux revenus</Link><h1 className="mt-3 text-3xl font-bold">Registre financier TR1</h1><p className="mt-2 max-w-3xl text-sm text-[#69717d]">Suivi manuel documenté des rémunérations TR1, indépendant des ventes des laboratoires. Montants HT. Aucune simulation ne crée automatiquement une écriture. Ce registre ne remplace ni la comptabilité ni la facturation.</p></header>
 {params.ok==="1"&&<p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Écriture enregistrée.</p>}
 {params.erreur&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{errors[params.erreur]??"Action refusée."}</p>}
 <p className="text-xs text-[#69717d]">Synthèse des {rows.length} dernières écritures sur {entries.count??rows.length}. Les statuts sont exclusifs, sans double comptage.</p>
 <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stages.map(s=><div key={s} className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold">{states[s]} · HT</p><p className="mt-2 text-2xl font-bold">{money(total(s))}</p></div>)}</section>
 <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Nouvelle écriture estimée</h2><p className="mt-2 text-xs text-[#69717d]">Uniquement sur une base documentée. Une estimation erronée peut être annulée avant acquisition puis recréée avec une référence de correction.</p>
 <form action={addRevenueEntry} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 <label className={label}>Marque / mandant<select name="brand_id" required className={field}><option value="">Choisir</option>{bs.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 <label className={label}>Pharmacie (facultatif)<select name="pharmacy_id" className={field}><option value="">Non applicable</option>{ps.map(p=><option key={p.id} value={p.id}>{p.name} · {p.city}</option>)}</select></label>
 <label className={label}>Catégorie<select name="kind" required className={field}>{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label className={label}>Intitulé<input name="title" required minLength={3} maxLength={180} className={field}/></label>
 <label className={label}>Référence unique / justificatif<input name="source_ref" required minLength={3} maxLength={300} placeholder="Contrat, mission, demande, période…" className={field}/></label>
 <label className={label}>Date de l’événement<input name="event_date" type="date" required className={field}/></label>
 <label className={label}>Montant HT (€)<input name="amount_ht" type="number" min="0.01" step="0.01" max="9999999999.99" required className={field}/></label>
 <button className="self-end rounded-lg bg-[#142941] p-3 text-sm font-bold text-white">Enregistrer l’estimation</button></form></section>
 <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Synthèse par marque</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Marque</th>{stages.map(s=><th key={s} className="p-2">{states[s]}</th>)}</tr></thead><tbody>{bs.map(b=><tr key={b.id} className="border-b"><td className="p-2 font-medium">{b.name}</td>{stages.map(s=><td key={s} className="p-2">{money(total(s,b.id))}</td>)}</tr>)}</tbody></table></div></section>
 <section className="space-y-3"><h2 className="text-xl font-bold">Écritures et justificatifs</h2>{rows.length===0&&<p className="rounded-xl border bg-white p-5 text-sm text-[#69717d]">Aucune écriture financière. Aucun revenu fictif ajouté.</p>}{rows.map(r=>{
 const next=r.status==="estimated"?"acquired":r.status==="acquired"?"invoiced":r.status==="invoiced"?"paid":null;
 return <article key={r.id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{r.title}</h3><p className="text-xs text-[#69717d]">{bs.find(b=>b.id===r.brand_id)?.name} · {types[r.kind]} · {r.event_date} · {ps.find(p=>p.id===r.pharmacy_id)?.name??"Sans pharmacie"}</p></div><div className="text-right"><p className="font-bold">{money(Number(r.amount_ht))} HT</p><p className="text-xs">{states[r.status]}</p></div></div>
 <div className="mt-3 space-y-1 break-words text-xs"><p>Source : {r.source_ref}</p>{r.acquired_on&&<p>Acquisition : {r.acquired_on} · {r.acquisition_ref}</p>}{r.invoiced_on&&<p>Facture : {r.invoiced_on} · {r.invoice_ref}</p>}{r.paid_on&&<p>Paiement intégral confirmé : {r.paid_on} · {r.payment_ref}</p>}{r.cancelled_ref&&<p>Annulation : {r.cancelled_ref}</p>}</div>
 {next&&<form action={advanceRevenueEntry} className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-3"><input type="hidden" name="id" value={r.id}/><input type="hidden" name="next" value={next}/><label className={label}>Date réelle<input name="event_date" type="date" required className={field}/></label><label className={label}>Justificatif<input name="reference" required minLength={3} maxLength={300} placeholder={next==="paid"?"Référence du règlement intégral":next==="invoiced"?"Numéro de facture":"Preuve du droit acquis"} className={field}/></label><button className="self-end rounded-lg bg-[#142941] p-3 text-sm font-bold text-white">Marquer {states[next].toLowerCase()}</button></form>}
 {r.status==="estimated"&&<form action={advanceRevenueEntry} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={r.id}/><input type="hidden" name="next" value="cancelled"/><label className={label}>Motif d’annulation<input name="reference" required minLength={3} maxLength={300} className={field}/></label><button className="rounded-lg border p-2.5 text-xs font-bold">Annuler l’estimation</button></form>}
 </article>})}</section>
 <p className="text-xs text-[#69717d]">Paiements partiels, avoirs, corrections après acquisition, échéances et TVA non gérés. Ne marquer « encaissée » qu’après règlement intégral.</p>
 </div>
}
