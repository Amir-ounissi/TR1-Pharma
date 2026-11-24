import Link from "next/link";
import { requireOwner } from "@/lib/auth";

const money=(value:number)=>value.toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
const statusLabels:Record<string,string>={received:"Reçue",verifying:"À vérifier",forwarded:"Transmise",confirmed:"Confirmée",closed:"Clôturée",declined:"Refusée"};

export default async function RevenusPage() {
  const {db}=await requireOwner();
  const [orders,brands,rules]=await Promise.all([
    db.from("order_requests").select("id,brand_id,total_ht,status,created_at",{count:"exact"}).order("created_at",{ascending:false}).limit(100),
    db.from("brands").select("id,name").order("name"),
    db.from("brand_commission_settings").select("brand_id,rate_percent,review_status,base_type,trigger_event,effective_from"),
  ]);
  if(orders.error||brands.error||rules.error) throw new Error("Impossible de charger le suivi financier.");
  const rows=orders.data??[];
  const active=rows.filter(x=>x.status!=="declined");
  const confirmed=rows.filter(x=>["confirmed","closed"].includes(x.status));
  const sum=(items:typeof rows)=>items.reduce((n,x)=>n+Math.round(Number(x.total_ht)*100),0)/100;
  const estimate=(row:typeof rows[number])=>{
    const rule=rules.data?.find(x=>x.brand_id===row.brand_id);
    if(!rule||rule.review_status!=="confirmed"||rule.base_type!=="order_ht"||rule.trigger_event!=="order_validated"||!rule.effective_from||row.created_at.slice(0,10)<rule.effective_from||!["confirmed","closed"].includes(row.status)) return null;
    return Math.round(Number(row.total_ht)*Number(rule.rate_percent))/100;
  };
  const estimated=confirmed.map(estimate).filter((x):x is number=>x!==null);
  return <div className="space-y-6 pb-10">
    <header><Link href="/app/revenus/registre" className="mb-4 inline-block rounded-lg bg-[#142941] px-4 py-2 text-sm font-bold text-white">Ouvrir le registre financier</Link><p className="text-xs font-bold uppercase tracking-widest text-[#a55925]">TR1 · Confidentiel</p><h1 className="mt-2 text-3xl font-bold">Mes revenus TR1</h1><p className="mt-2 max-w-3xl text-sm text-[#69717d]">Suivi du CA apporté aux marques et simulations de commissions. Les demandes ne sont ni des factures ni des encaissements. Les montants ci-dessous portent sur les {rows.length} demandes les plus récentes ({orders.count??rows.length} au total).</p></header>
    <section className="grid gap-3 sm:grid-cols-3">
      {[["Demandes non refusées",money(sum(active))],["Demandes confirmées / clôturées",money(sum(confirmed))],["Commission théorique éligible",estimated.length?money(estimated.reduce((a,b)=>a+b,0)):"Non calculable"]].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-5"><p className="text-xs text-[#69717d]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Synthèse par marque</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-[#69717d]"><th className="p-2">Marque</th><th className="p-2">Demandes HT</th><th className="p-2">Confirmées HT</th><th className="p-2">Règle actuelle</th><th className="p-2">Estimation</th></tr></thead><tbody>{(brands.data??[]).map(b=>{const r=rules.data?.find(x=>x.brand_id===b.id);const all=active.filter(x=>x.brand_id===b.id);const ok=confirmed.filter(x=>x.brand_id===b.id);const amounts=ok.map(estimate).filter((x):x is number=>x!==null);return <tr key={b.id} className="border-b"><td className="p-2 font-medium">{b.name}</td><td className="p-2">{money(sum(all))}</td><td className="p-2">{money(sum(ok))}</td><td className="p-2">{r?Number(r.rate_percent)+" % · "+(r.review_status==="confirmed"?"validée":"brouillon"):"À définir"}</td><td className="p-2">{amounts.length?money(amounts.reduce((a,b)=>a+b,0)):"—"}</td></tr>})}</tbody></table></div></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Détail des demandes</h2>{rows.length?<div className="mt-3 divide-y">{rows.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><Link href={"/app/commandes/"+x.id+"/document"} className="font-semibold underline">{brands.data?.find(b=>b.id===x.brand_id)?.name??"Marque"} · {x.id.slice(0,8)}</Link><p className="text-xs text-[#69717d]">{new Date(x.created_at).toLocaleDateString("fr-FR")} · {statusLabels[x.status]??x.status}</p></div><span>{money(Number(x.total_ht))} HT</span><span>{estimate(x)===null?"Non estimée":money(estimate(x)!)+" estimés"}</span></div>)}</div>:<p className="mt-3 text-sm text-[#69717d]">Aucune demande réelle enregistrée.</p>}</section>
    <section className="rounded-xl border bg-[#fafbfb] p-5 text-sm leading-6"><h2 className="font-bold">Limites du calcul</h2><p className="mt-2">Simulation uniquement avec une règle actuellement confirmée, assiette commande HT, déclencheur validation de commande et date d'effet antérieure à la demande. La règle historique et la date de validation ne sont pas figées à ce stade. Les primes, forfaits, commissions à l'encaissement, avoirs, factures et paiements nécessitent un registre financier dédié. Aucun montant dû, facturé ou payé n'est déduit de ces estimations.</p><Link href="/app/commissions" className="mt-3 inline-block font-bold underline">Paramétrer les règles contractuelles</Link></section>
  </div>;
}
