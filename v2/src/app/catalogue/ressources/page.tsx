import Link from "next/link";
import {requirePharmacy} from "@/lib/auth";
import {resourceCategoryLabel} from "@/lib/communication-labels";
export default async function ResourcesPage(){
 const {db}=await requirePharmacy();
 const [resources,brands]=await Promise.all([db.from("tr1_resources").select("id,title,description,category,brand_id,resource_url,starts_on,ends_on").eq("published",true).order("created_at",{ascending:false}).limit(200),db.from("brands").select("id,name")]);
 if(resources.error||brands.error)throw new Error("Impossible de charger la bibliothèque.");
 const rows=resources.data??[];
 return <div className="space-y-6 pb-12"><header className="rounded-2xl bg-[#142941] p-7 text-white"><p className="text-xs font-bold uppercase tracking-widest text-[#e8b180]">Documents et outils officinaux</p><h1 className="mt-3 text-3xl font-bold">Bibliothèque de ressources</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">Retrouvez les catalogues, fiches produits, argumentaires, supports de formation et outils de mise en avant partagés par TR1.</p></header>
 <div className="flex items-center justify-between gap-3"><Link href="/catalogue/actualites" className="text-sm font-semibold underline">← Actualités</Link><span className="text-xs text-[#71818c]">{rows.length} ressource(s)</span></div>
 {rows.length===0&&<p className="rounded-xl border bg-white p-7 text-sm text-[#69717d]">Aucune ressource publiée pour votre officine pour le moment.</p>}
 <div className="grid gap-3 md:grid-cols-2">{rows.map(r=><article key={r.id} className="flex flex-col rounded-xl border bg-white p-5"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-[#edf3f5] px-3 py-1 text-xs font-bold">{resourceCategoryLabel(r.category)}</span><span className="text-xs text-[#6e7f8b]">{brands.data?.find(b=>b.id===r.brand_id)?.name||"TR1 PHARMA"}</span></div><h2 className="mt-3 text-lg font-bold">{r.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-[#607482]">{r.description}</p><a href={r.resource_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-[#142941] px-4 py-2.5 text-sm font-bold text-white">Ouvrir la ressource ↗</a></article>)}</div>
 <p className="text-xs text-[#7b8991]">Les ressources sont partagées par TR1. Vérifier la version et la date de validité indiquées par le laboratoire.</p></div>;
}
