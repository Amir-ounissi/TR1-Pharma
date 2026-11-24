import Link from "next/link";
import {requireOwner} from "@/lib/auth";
import {statuses} from "@/lib/support-labels";
import {ownerReply,updateSupportStatus} from "@/app/support-actions";
import {SupportThread} from "@/components/support/thread";
export default async function RelationClient({searchParams}:{searchParams:Promise<{ok?:string;erreur?:string;filtre?:string}>}){
 const {db}=await requireOwner();const params=await searchParams;
 const filter=params.filtre==="resolved"?"resolved":params.filtre==="all"?"all":"open";
 let query=db.from("pharmacy_support_requests").select("id,pharmacy_id,category,subject,brand_label,body,status,created_at").order("created_at",{ascending:false}).limit(100);
 if(filter==="open")query=query.neq("status","resolved");else if(filter==="resolved")query=query.eq("status","resolved");
 const [requests,pharmacies,count]=await Promise.all([query,db.from("pharmacies").select("id,name,city"),db.from("pharmacy_support_requests").select("id",{count:"exact",head:true}).neq("status","resolved")]);
 if(requests.error||pharmacies.error||count.error)throw new Error("Impossible de charger les demandes clients.");
 const rows=requests.data??[],ps=pharmacies.data??[];
 const messages=rows.length?await db.from("pharmacy_support_messages").select("id,request_id,sender_role,body,created_at").in("request_id",rows.map(r=>r.id)).order("created_at").limit(1000):{data:[],error:null};
 if(messages.error)throw new Error("Impossible de charger les messages.");
 return <div className="space-y-6 pb-12"><header><p className="text-xs font-bold uppercase tracking-widest text-[#a55925]">Priorité relation officinale</p><h1 className="mt-2 text-3xl font-bold">Centre de demandes clients</h1><p className="mt-2 text-sm text-[#69717d]">Un interlocuteur unique : questions, rendez-vous, animations, formations, PLV, suivi fournisseur et litiges. Répondre ici ; transmettre au laboratoire séparément si nécessaire.</p></header>
 <section className="rounded-xl border bg-white p-5"><p className="text-xs text-[#69717d]">Demandes ouvertes</p><p className="mt-2 text-3xl font-bold">{count.count??0}</p><p className="mt-2 text-xs text-[#69717d]">Consulter régulièrement le centre. Les notifications externes ne sont pas encore activées.</p></section>
 {params.ok==="1"&&<p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Échange ou statut enregistré.</p>}{params.erreur&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Action refusée. Vérifier les champs et le statut.</p>}
 <nav className="flex flex-wrap gap-2">{[["open","À suivre"],["resolved","Résolues"],["all","Toutes"]].map(([key,value])=><Link key={key} href={"/app/relation-client?filtre="+key} className={"rounded-lg border px-4 py-2 text-sm font-semibold "+(filter===key?"bg-[#142941] text-white":"bg-white")}>{value}</Link>)}</nav><p className="text-xs text-[#69717d]">100 demandes récentes selon le filtre, jusqu’à 1 000 messages affichés.</p>
 {rows.length===0&&<p className="rounded-xl border bg-white p-6 text-sm text-[#69717d]">Aucune demande dans cette vue.</p>}
 {rows.map(r=><article key={r.id} id={r.id} className="rounded-xl border bg-white p-5"><SupportThread request={r} messages={(messages.data??[]).filter(m=>m.request_id===r.id)} pharmacyName={ps.find(p=>p.id===r.pharmacy_id)?.name??"Officine"}/>{r.status!=="resolved"&&<form action={ownerReply} className="mt-4 flex flex-col gap-2"><input type="hidden" name="request_id" value={r.id}/><label className="grid gap-1 text-xs font-bold">Réponse visible par l’officine<textarea name="body" rows={3} required maxLength={4000} className="rounded-lg border p-3 text-sm"/></label><button className="self-end rounded-lg bg-[#142941] px-4 py-2 text-sm font-bold text-white">Envoyer la réponse</button></form>}<form action={updateSupportStatus} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"><input type="hidden" name="request_id" value={r.id}/><label className="grid gap-1 text-xs font-bold">Statut<select name="status" defaultValue={r.status} className="rounded-lg border bg-white p-2 text-sm">{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{k==="waiting_client"?"Attente de l’officine":v}</option>)}</select></label><button className="rounded-lg border px-4 py-2 text-xs font-bold">Enregistrer le statut</button></form></article>)}
 <Link href="/app/commandes" className="text-sm font-semibold underline">Transmission des commandes aux marques</Link></div>;
}
