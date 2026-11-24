import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, PackageOpen, ShieldAlert, Info, Calculator, Truck } from "lucide-react";
import { loadAlthesiaShowroom, euro, althesiaPricing, isBlocked } from "@/lib/althesia-showroom";

export default async function AlthesiaDetails({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const all=await loadAlthesiaShowroom();
  const p=all.find(x=>x.id===id);
  if(!p)notFound();
  const blocked=isBlocked(p);
  const vat=Number(p.vat_rate??5.5);
  const pvc=p.retail_ttc===null?null:Number(p.retail_ttc);
  return <div className="space-y-6 pb-14">
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap gap-2 text-xs text-[#6e7e89]">
      <Link href="/catalogue/althesia" className="hover:underline">Althesia</Link><span>/</span>
      <Link href={`/catalogue/althesia?marque=${p.brand_slug}`} className="hover:underline">{p.brand}</Link><span>/</span>
      <span className="font-semibold text-[#142941]">{p.name}</span>
    </nav>
    <Link href="/catalogue/althesia" className="inline-flex items-center gap-2 text-sm font-semibold text-[#235571] hover:underline"><ArrowLeft size={15}/> Catalogue multimarque</Link>
    <div className={`rounded-xl border px-5 py-4 text-xs leading-5 ${blocked?"border-red-200 bg-red-50 text-red-800":"border-[#eadbc2] bg-[#fff9ef] text-[#81532b]"}`}>
      <div className="flex items-start gap-2"><ShieldAlert size={18} className="mt-0.5 shrink-0"/>
        <p><strong>{blocked?"Produit CBD alimentaire : non proposé à la vente.":"Information de catalogue historique, non commercialisée."}</strong>
        {" "}Composition, prix et allégations doivent être reconfirmés. Les conditions affichées ne constituent ni une offre ferme ni un bon de commande.</p>
      </div>
    </div>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_355px]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-xl border border-[#e1e7e9] bg-white">
          <div className="flex h-[320px] items-center justify-center bg-[#f7f9f9] px-10 py-7 sm:h-[410px]">
            {p.image_url?<img src={p.image_url} alt={p.name} className="h-full max-w-full object-contain"/>:
              <div className="text-center text-[#92a2ae]"><PackageOpen className="mx-auto" size={52}/><p className="mt-3 text-sm">Photographie produit à compléter</p></div>}
          </div>
          <div className="border-t border-[#e9edef] px-6 py-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#5e798d]">{p.brand} {p.sub_brand?"· "+p.sub_brand:""}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#142941]">{p.name}</h1>
            <p className="mt-2 text-sm text-[#71828f]">{p.category||"Rayon à confirmer"} · {p.format||"Format à confirmer"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-[#eff3f5] px-3 py-2 font-mono text-xs text-[#506979]">EAN {p.ean||"—"}</span>
              <span className="rounded-md bg-[#eff3f5] px-3 py-2 font-mono text-xs text-[#506979]">Réf. {p.sku}</span>
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-[#e1e7e9] bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#142941]"><BookOpen size={18}/> Informations officinales</h2>
          <p className="mt-3 text-xs leading-5 text-[#73838f]">{p.summary||"Information source partielle."}</p>
          <div className="mt-5 space-y-5">
            {[
              ["Composition quantitative / actifs",p.ingredients||"Composition et dosages non disponibles dans le document commercial fourni."],
              ["Posologie et durée",p.dosage||"Non documentées dans la source fournie."],
              ["Public concerné",p.audience||"À confirmer sur l'étiquette et auprès de la marque."],
              ["Précautions et contre-indications",p.precautions||"À vérifier dans la notice et l'étiquetage officiel avant tout conseil."],
              ["Allégations utilisables au comptoir","Non validées. Ne pas reprendre automatiquement les promesses marketing du catalogue."],
            ].map(([label,value])=><div key={label} className="border-t border-[#e9edef] pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#566d7e]">{label}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#334a5e]">{value}</p>
            </div>)}
          </div>
        </section>
        <section className="rounded-xl border border-[#e1e7e9] bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#142941]"><Info size={18}/> Source et contrôle qualité</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-[#647887]">Document</dt><dd className="mt-1 break-words font-medium">{p.source_document}</dd></div>
            <div><dt className="text-xs font-semibold text-[#647887]">Page</dt><dd className="mt-1 font-medium">{p.source_page??"Non précisée"}</dd></div>
            <div><dt className="text-xs font-semibold text-[#647887]">Période du tarif</dt><dd className="mt-1 font-medium">Septembre 2026 (source) — à actualiser</dd></div>
            <div><dt className="text-xs font-semibold text-[#647887]">Conformité commerciale</dt><dd className="mt-1 font-medium">{blocked?"Bloquée — CBD alimentaire":"En attente de contrôle"}</dd></div>
          </dl>
        </section>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-5">
        <section className="rounded-xl border border-[#d5e0e5] bg-white p-5 shadow-[0_5px_20px_rgb(14_29_49/0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#946038]">Tarifs du catalogue — non reconfirmés</p>
          <p className="mt-4 text-xs text-[#6e7c88]">Prix de vente conseillé TTC (source)</p>
          <p className="mt-1 text-3xl font-extrabold text-[#142941]">{euro(pvc)}</p>
          <p className="mt-1 text-xs text-[#73828d]">TVA indiquée : {vat.toLocaleString("fr-FR")}%</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-[#e2e8ec] bg-[#f5f7f8] text-[#566c7d]">
                <tr><th className="px-2 py-3">Achat</th><th className="px-2 py-3">UG</th><th className="px-2 py-3 text-right">PA HT/u.</th></tr>
              </thead>
              <tbody className="divide-y divide-[#e9eef1]">
                {p.offers.map(x=><tr key={x.paid_quantity}>
                  <td className="px-2 py-3 font-semibold">{x.paid_quantity} u.</td>
                  <td className="px-2 py-3">{x.free_quantity?"+"+x.free_quantity:"—"}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums">{euro(x.price_ht)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {p.offers.length>0 && pvc!==null && <div className="mt-4 rounded-lg bg-[#f6f8f9] p-4">
            <div className="flex items-center gap-2"><Calculator size={17} className="text-[#5e7383]"/><h3 className="text-xs font-bold text-[#142941]">Marge indicative par palier</h3></div>
            <p className="mt-2 text-[11px] leading-5 text-[#788690]">Marge théorique calculée sur le PVC HT et le coût net des unités livrées, sans franco, frais, remises multi-marques ni autres coûts.</p>
            <div className="mt-3 space-y-2">
              {p.offers.map(o=>{
                const cal=althesiaPricing(o,pvc,vat);
                return <div key={o.paid_quantity} className="flex justify-between gap-2 border-t border-[#e3e8ea] pt-2 text-xs">
                  <span>{o.paid_quantity} payées + {o.free_quantity} UG</span>
                  <strong className="text-[#314f64]">{cal.marginRate===null?"n.d.":cal.marginRate.toFixed(1).replace(".",",")+" %"} estimés</strong>
                </div>;
              })}
            </div>
          </div>}
          <p className="mt-4 rounded-lg border border-[#eadbc4] bg-[#fff9ef] p-3 text-[11px] leading-5 text-[#82552d]">
            {blocked?"Cette référence ne peut pas être commandée depuis TR1.":"Ces tarifs ne sont pas confirmés pour une commande."}
          </p>
        </section>
        <section className="rounded-xl border border-[#e1e7e9] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#142941]"><Truck size={17}/> Conditions logistiques Althesia (source)</h2>
          <div className="mt-3 space-y-2 text-xs leading-5 text-[#647684]">
            <p>Franco : 1 marque 200 € HT · 2 marques 300 € HT · 3 marques 400 € HT.</p>
            <p>Remise multi-marques : 2 marques 2,5 % · 3 marques 5 %, sous conditions de référencement.</p>
            <p>Délais, stock et frais éventuels : <strong>non confirmés</strong>.</p>
          </div>
        </section>
      </aside>
    </div>
    <p className="text-xs text-[#788691]">Fiche documentaire privée, sans fonction d'achat. Toute mise en vente demande la validation de la marque, du tarif, de l'étiquetage et des obligations réglementaires.</p>
  </div>;
}
