import Link from "next/link";
import { requireOwner } from "@/lib/auth";

export default async function CatalogueQuality({searchParams}:{searchParams:Promise<{marque?:string}>}) {
  const { db } = await requireOwner();
  const filters = await searchParams;
  const [b,p,stopped,specs,media] = await Promise.all([
    db.from("brands").select("id,name,slug,active").order("name"),
    db.from("products").select("id,brand_id,name,sku,ean,description,image_url,source_active,source_document,editorial_source_url,price_ht,price_verified,requires_review,published,fr_market_checked,fr_label_checked,fr_market_document").order("name").limit(500),
    db.from("product_discontinuations").select("brand_id,ean"),db.from("althesia_product_specs").select("product_id,market_status"),db.from("product_media_audit").select("product_id,image_review_status,applied_to_draft,candidate_image_url"),
  ]);
  if(b.error||p.error||stopped.error||specs.error||media.error)throw new Error("Impossible de charger l'audit catalogue.");
  const brands=b.data||[],archived=new Set((stopped.data??[]).map(d=>d.brand_id+":"+d.ean)),products=(p.data||[]).filter(x=>!archived.has(x.brand_id+":"+x.ean));
  const selected=brands.find(x=>x.slug===filters.marque)||brands.find(x=>x.slug==="vk-swiss")||brands[0];
  const rows=products.filter(x=>x.brand_id===selected?.id);
  const missing=(x:typeof rows[number])=>{
    const problems:string[]=[];
    if(!x.ean)problems.push("EAN");
    if(!x.image_url?.startsWith("https://")||(media.data??[]).some(a=>a.product_id===x.id&&(a.image_review_status!=="verified"||!a.applied_to_draft||a.candidate_image_url!==x.image_url)))problems.push("Visuel / validation photo");
    if(!x.description||x.description.trim().length<10)problems.push("Description");
    if(!x.editorial_source_url&&!x.source_document)problems.push("Source");
    if(x.requires_review)problems.push("Contrôle fiche");
    if(!x.price_verified||Number(x.price_ht)<=0)problems.push("Prix");
    if(x.source_active===false)problems.push("Disponibilité fournisseur à reconfirmer");
    const spec=specs.data?.find(s=>s.product_id===x.id);if(spec&&spec.market_status!=="verified")problems.push(spec.market_status==="food_cbd_blocked"?"Blocage réglementaire spécifique":"Validation Althesia");
    if(!brands.find(b=>b.id===x.brand_id)?.active)problems.push("Ouverture marque");
    if(!x.fr_market_checked||!x.fr_label_checked||(x.fr_market_document||"").trim().length<6)problems.push("Conformité marché français");
    return problems;
  };
  const score=(id:string)=>products.filter(x=>x.brand_id===id);
  return <div className="space-y-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#ad4b08]">Qualité des données</p>
      <h1 className="mt-2 text-3xl font-bold">Mise en service commerciale</h1>
      <p className="mt-2 text-sm text-[#69717d]">Audit avant publication : la conformité des allégations, l'étiquetage et le tarif contractuel nécessitent toujours une validation humaine.</p>
    </div>
    <div className="flex flex-wrap gap-2"><Link href="/app/catalogue-public/liens" className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Générer un lien pharmacie</Link><Link href="/app/medias" className="rounded-lg border bg-white px-4 py-3 text-sm font-bold">Contrôler les visuels</Link></div>
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
