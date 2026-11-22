import Link from "next/link";
import { requireOwner } from "@/lib/auth";

export default async function CatalogueQuality({searchParams}:{searchParams:Promise<{marque?:string}>}) {
  const { db } = await requireOwner();
  const filters = await searchParams;
  const [b,p] = await Promise.all([
    db.from("brands").select("id,name,slug,active").order("name"),
    db.from("products").select("id,brand_id,name,sku,ean,description,image_url,source_active,source_document,editorial_source_url,price_verified,requires_review,published").order("name").limit(500),
  ]);
  if(b.error||p.error)throw new Error("Impossible de charger l'audit catalogue.");
  const brands=b.data||[], products=p.data||[];
  const selected=brands.find(x=>x.slug===filters.marque)||brands.find(x=>x.slug==="vk-swiss")||brands[0];
  const rows=products.filter(x=>x.brand_id===selected?.id);
  const missing=(x:typeof rows[number])=>{
    const problems:string[]=[];
    if(!x.ean)problems.push("EAN");
    if(!x.image_url)problems.push("Visuel");
    if(!x.description||x.description.trim().length<10)problems.push("Description");
    if(!x.editorial_source_url&&!x.source_document)problems.push("Source");
    if(x.requires_review)problems.push("Contrôle fiche");
    if(!x.price_verified)problems.push("Prix");
    return problems;
  };
  const score=(id:string)=>products.filter(x=>x.brand_id===id);
  return <div className="space-y-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#ad4b08]">Qualité des données</p>
      <h1 className="mt-2 text-3xl font-bold">Préparation du catalogue B2B</h1>
      <p className="mt-2 text-sm text-[#69717d]">Audit avant publication : la conformité des allégations, l'étiquetage et le tarif contractuel nécessitent toujours une validation humaine.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {brands.map(x=>{
        const items=score(x.id);
        return <Link key={x.id} href={"/app/qualite?marque="+x.slug}
          className={"rounded-xl border p-4 "+(x.id===selected?.id?"border-[#ea7015] bg-[#fff8ef]":"bg-white")}>
          <h2 className="text-sm font-bold">{x.name}</h2>
          <p className="mt-3 text-2xl font-extrabold">{items.length}</p>
          <p className="mt-1 text-xs text-[#69717d]">{items.filter(z=>z.published).length} publiées · {items.filter(z=>missing(z).length>0).length} à contrôler</p>
        </Link>;
      })}
    </div>
    {selected ? <section className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5">
        <div><h2 className="text-xl font-bold">{selected.name}</h2><p className="mt-1 text-xs text-[#69717d]">{rows.length} produits · {selected.active?"Marque active":"Marque inactive"}</p></div>
        <Link href={"/app/produits?marque="+selected.id} className="rounded-lg border px-4 py-2 text-sm font-bold">Ouvrir les fiches</Link>
      </div>
      <div className="divide-y">
        {rows.length?rows.map(x=>{
          const problems=missing(x);
          return <article key={x.id} className="flex flex-wrap justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <Link href={"/app/produits/"+x.id} className="font-semibold hover:underline">{x.name}</Link>
              <p className="mt-1 text-xs text-[#69717d]">{x.sku} · {x.ean||"EAN manquant"}</p>
              <p className="mt-2 text-xs text-[#69717d]">{problems.length? "À vérifier : "+problems.join(", "):"Critères techniques renseignés"}</p>
              {x.editorial_source_url?
                <a href={x.editorial_source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold underline">Fiche officielle de la marque</a>:null}
            </div>
            <div className="text-right">
              <p className={"text-xs font-bold "+(x.published?"text-green-700":"text-[#ad4b08]")}>{x.published?"Publié":"Brouillon"}</p>
              <Link href={"/app/produits/"+x.id} className="mt-3 inline-block rounded-lg bg-[#142941] px-4 py-2 text-xs font-bold text-white">Examiner</Link>
            </div>
          </article>;
        }):<p className="p-6 text-sm text-[#69717d]">Aucun produit dans cette marque.</p>}
      </div>
    </section>:null}
    <p className="text-xs text-[#69717d]">Les prix importés ne sont pas réputés valables : la validation du fournisseur et de l'officine doit précéder toute activation.</p>
  </div>;
}
