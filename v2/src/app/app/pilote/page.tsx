import Link from "next/link";
import { requireOwner } from "@/lib/auth";

function StatusLine({done, label, detail}: {done:boolean,label:string,detail:string}) {
  return <div className="flex gap-3 border-b py-4 last:border-0">
    <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold "+
      (done?"bg-green-100 text-green-800":"bg-[#fff2df] text-[#a04b0d]")}>{done?"✓":"!"}</span>
    <div><strong className="text-sm">{label}</strong>
      <p className="mt-1 text-xs leading-5 text-[#69717d]">{detail}</p>
    </div>
  </div>;
}

export default async function PharmacyPilot() {
  const { db } = await requireOwner();
  const [pharmacyResult, brandResult] = await Promise.all([
    db.from("pharmacies").select("id,name,city,source_system,source_pharmacy_id")
      .eq("source_system","tr1_legacy_production")
      .eq("source_pharmacy_id","78416589-4206-4b08-915b-d048bf7bb176").maybeSingle(),
    db.from("brands").select("id,name,slug,active").eq("slug","vk-swiss").maybeSingle(),
  ]);
  if(pharmacyResult.error||brandResult.error)throw new Error("Impossible de charger le pilote.");
  const pharmacy=pharmacyResult.data,brand=brandResult.data;
  const [products,access,members,terms,requests] = await Promise.all([
    brand ? db.from("products").select(
      "id,name,sku,ean,format,description,price_ht,vat_rate,image_url,editorial_source_url,published,requires_review,price_verified,fr_market_checked,fr_label_checked,fr_market_document"
    ).eq("brand_id",brand.id).order("name") : Promise.resolve({data:[],error:null}),
    pharmacy&&brand ? db.from("pharmacy_brand_access").select("active")
      .eq("pharmacy_id",pharmacy.id).eq("brand_id",brand.id).maybeSingle() : Promise.resolve({data:null,error:null}),
    pharmacy ? db.from("pharmacy_memberships").select("user_id,active")
      .eq("pharmacy_id",pharmacy.id).eq("active",true) : Promise.resolve({data:[],error:null}),
    brand ? db.from("brand_trade_terms").select("verified").eq("brand_id",brand.id).maybeSingle() : Promise.resolve({data:null,error:null}),
    pharmacy&&brand ? db.from("order_requests").select("id,status,created_at")
      .eq("pharmacy_id",pharmacy.id).eq("brand_id",brand.id).limit(15) : Promise.resolve({data:[],error:null}),
  ]);
  if([products,access,members,terms,requests].some(x=>x.error))throw new Error("Impossible de vérifier l'état du pilote.");
  const items=products.data??[];
  const complete=items.filter(x=>!x.requires_review&&x.price_verified&&x.fr_market_checked&&x.fr_label_checked
    &&(x.fr_market_document||"").trim().length>=6&&x.ean&&x.description&&x.image_url);
  const published=items.filter(x=>x.published);
  const membersCount=(members.data??[]).length;
  const isAccessOn=!!access.data?.active;
  const isBrandActive=!!brand?.active;
  const allowRealOrders=!!pharmacy&&isAccessOn&&isBrandActive&&membersCount>0&&published.length>0;
  return <div className="space-y-7">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#ad4b08]">Pilote de validation interne</p>
      <h1 className="mt-2 text-3xl font-bold">VK SWISS · Pharmacie Plein Sud</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#69717d]">
        Pharmacie de Pérols, enregistrée dans la V2 depuis la base historique en lecture seule. Cette page est
        réservée au propriétaire TR1. Il ne s'agit pas d'un catalogue accessible au client.
      </p>
    </header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Produits importés",items.length+" / 6"],
        ["Fiches complètes et validées",complete.length+" / "+items.length],
        ["Produits publiés",published.length],
        ["Demandes B2B",requests.data?.length??0],
      ].map(([label,value])=><div className="rounded-xl border bg-white p-5" key={label}>
        <p className="text-xs font-semibold text-[#69717d]">{label}</p>
        <p className="mt-3 text-3xl font-extrabold">{value}</p>
      </div>)}
    </div>
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">Conditions d'ouverture du pilote</h2>
      <div className="mt-3">
        <StatusLine done={!!pharmacy} label="Pharmacie identifiée dans la V2"
          detail={pharmacy?`${pharmacy.name} — ${pharmacy.city}. Aucun compte client ni email de contact n'a été importé.`:"Pharmacie non trouvée."}/>
        <StatusLine done={!!terms.data?.verified} label="Conditions commerciales confirmées"
          detail="Minimum de commande, prix HT, franco et modalités de livraison doivent être vérifiés avec VK SWISS."/>
        <StatusLine done={complete.length===items.length&&items.length>0} label="Fiches et conformité France contrôlées"
          detail={`${complete.length} fiche(s) sur ${items.length} contrôlée(s). L'étiquetage et le justificatif réglementaire doivent être vérifiés et documentés.`}/>
        <StatusLine done={isBrandActive&&published.length>0} label="Marque activée et produits publiés"
          detail={`Marque ${isBrandActive?"active":"inactive"}, ${published.length} référence(s) publiées. Toutes les publications sont manuelles.`}/>
        <StatusLine done={membersCount>0} label="Compte professionnel pharmacie associé"
          detail={`${membersCount} utilisateur(s) associé(s). Le compte doit avoir été créé et confirmé dans Supabase Auth V2.`}/>
        <StatusLine done={isAccessOn} label="Accès VK SWISS autorisé pour cette pharmacie"
          detail="Autorisation B2B encore désactivée tant que les validations ne sont pas terminées."/>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/app/qualite?marque=vk-swiss" className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Contrôler les 6 fiches</Link>
        <Link href={brand?"/app/conditions?marque="+brand.id:"/app/conditions"} className="rounded-lg border px-4 py-3 text-sm font-bold">Conditions VK SWISS</Link>
        <Link href="/app/acces" className="rounded-lg border px-4 py-3 text-sm font-bold">Gérer les accès B2B</Link>
      </div>
      <p className={"mt-5 rounded-lg p-4 text-sm font-bold "+(allowRealOrders?"bg-green-50 text-green-800":"bg-[#fff2df] text-[#8c460a]")}>
        {allowRealOrders?"Le pilote dispose des accès nécessaires à une demande B2B. Vérifier encore la disponibilité des produits avant transmission.":
          "Le parcours réel de commande reste fermé. Aucun message ni commande ne sera envoyé à la pharmacie par cet écran."}
      </p>
    </section>
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">Aperçu interne des fiches VK SWISS</h2>
      <p className="mt-2 text-sm text-[#69717d]">Tarifs repris de l'ancien catalogue : valeurs indicatives internes, non confirmées et non visibles par les pharmacies.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(x=><article key={x.id} className="overflow-hidden rounded-lg border">
          <div className="flex h-40 items-center justify-center bg-[#f9f9f8] p-3">
            {x.image_url?<img src={x.image_url} alt={x.name} className="h-full max-w-full object-contain" />:
              <span className="text-xs text-[#69717d]">Visuel manquant</span>}
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#ad4b08]">Brouillon · Aperçu TR1 uniquement</p>
            <h3 className="font-bold">{x.name}</h3>
            <p className="text-xs text-[#69717d]">EAN {x.ean} · {x.format||"Format à vérifier"}</p>
            <p className="line-clamp-3 text-sm text-[#69717d]">{x.description||"Description non renseignée"}</p>
            <p className="font-bold">{Number(x.price_ht).toFixed(2)} € HT <span className="text-xs font-normal text-[#ad4b08]">à vérifier</span></p>
            <div className="flex flex-wrap gap-3 pt-2 text-xs font-semibold">
              <Link href={"/app/produits/"+x.id} className="underline">Examiner la fiche</Link>
              {x.editorial_source_url?<a href={x.editorial_source_url} target="_blank" rel="noopener noreferrer" className="underline">Source officielle</a>:null}
            </div>
          </div>
        </article>)}
      </div>
    </section>
  </div>;
}
