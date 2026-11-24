import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, PackageOpen, ShieldAlert, Info, Calculator, Truck } from "lucide-react";
import { loadAlthesiaShowroom, euro, althesiaPricing, formatMultiplicateur, isBlocked } from "@/lib/althesia-showroom";

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
        <p><strong>{blocked?"Référence contenant des cannabinoïdes : présentation documentaire uniquement.":"Produit présenté par TR1 en qualité d'intermédiaire commercial."}</strong>
        {" "}TR1 ne vend ni ne facture ces produits. Les compositions et allégations nécessitent une vérification ; les éventuels tarifs du fournisseur ne valent pas offre ferme. Aucune commande n'est possible sur cette page.</p>
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
            <div><dt className="text-xs font-semibold text-[#647887]">Conformité commerciale</dt><dd className="mt-1 font-medium">{blocked?"Vigilance renforcée — cannabinoïdes":"En attente de contrôle"}</dd></div>
            <div><dt className="text-xs font-semibold text-[#647887]">Statut de TR1</dt><dd className="mt-1 font-medium">Agent commercial intermédiaire, non vendeur</dd></div>
          </dl>
        </section>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-5">
        {blocked?<section className="rounded-xl border border-[#eadac8] bg-[#fffaf2] p-5">
          <h2 className="text-sm font-bold text-[#7f4c25]">Référence documentaire — statut réglementaire à vérifier</h2>
          <p className="mt-3 text-xs leading-6 text-[#785c47]">
            Les informations de prix d'achat, les offres et les marges ne sont pas diffusées pour cette référence.
            Les denrées alimentaires contenant du CBD ne sont pas autorisées à la vente en France selon les autorités.
            Le régime applicable à cette forme de produit doit être confirmé avant toute prospection commerciale.
          </p>
          <a href="https://agriculture.gouv.fr/node/110883" target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-block text-xs font-semibold underline">Consulter le ministère de l'Agriculture</a>
        </section>:<section className="rounded-xl border border-[#d5e0e5] bg-white p-5 shadow-[0_5px_20px_rgb(14_29_49/0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#946038]">Conditions fournisseur historiques — à reconfirmer</p>
          <p className="mt-4 text-xs text-[#6e7c88]">Prix de vente conseillé TTC (source)</p>
          <p className="mt-1 text-3xl font-extrabold text-[#142941]">{euro(pvc)}</p>
          <p className="mt-1 text-xs text-[#73828d]">TVA indiquée : {vat.toLocaleString("fr-FR")}%</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-[#e2e8ec] bg-[#f5f7f8] text-[#566c7d]">
                <tr><th className="px-2 py-3">Achat</th><th className="px-2 py-3">UG</th><th className="px-2 py-3 text-right">PA HT/u.</th><th className="px-2 py-3 text-right">Coef.</th></tr>
              </thead>
              <tbody className="divide-y divide-[#e9eef1]">
                {p.offers.map(x=><tr key={x.paid_quantity}>
                  <td className="px-2 py-3 font-semibold">{x.paid_quantity} u.</td>
                  <td className="px-2 py-3">{x.free_quantity?"+"+x.free_quantity:"—"}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums">{euro(x.price_ht)}</td>
                  <td className="px-2 py-3 text-right font-extrabold tabular-nums text-[#1c5975]">{formatMultiplicateur(althesiaPricing(x,pvc,vat).multiplier)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {p.offers.length>0 && pvc!==null && <div className="mt-4 rounded-lg bg-[#f6f8f9] p-4">
            <div className="flex items-center gap-2"><Calculator size={17} className="text-[#5e7383]"/><h3 className="text-xs font-bold text-[#142941]">Coefficient et marge par palier</h3></div>
            <p className="mt-2 text-[11px] leading-5 text-[#788690]">Coefficient multiplicateur = PVC TTC ÷ coût d'achat HT net par unité livrée, UG comprises. Taux de marque indicatif calculé sur le PVC HT. Hors frais, remise multi-marques et autres coûts. Prix source non reconfirmés.</p>
            <div className="mt-3 space-y-2">
              {p.offers.map(o=>{
                const cal=althesiaPricing(o,pvc,vat);
                return <div key={o.paid_quantity} className="flex justify-between gap-2 border-t border-[#e3e8ea] pt-2 text-xs">
                  <span>{o.paid_quantity} payées + {o.free_quantity} UG</span>
                  <strong className="text-right text-[#314f64]">{formatMultiplicateur(cal.multiplier)}<span className="block font-normal text-[#6d7f8c]">{cal.marginRate===null?"n.d.":cal.marginRate.toFixed(1).replace(".",",")+" %"} de taux de marque HT</span></strong>
                </div>;
              })}
            </div>
          </div>}
          <p className="mt-4 rounded-lg border border-[#eadbc4] bg-[#fff9ef] p-3 text-[11px] leading-5 text-[#82552d]">
            Ces tarifs du fournisseur ne sont pas confirmés et ne constituent pas une offre d'achat.
          </p>
        </section>}
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
    <p className="text-xs text-[#788691]">TR1 PHARMA : présentation et négociation pour le compte des marques représentées, sans facturation ni livraison des produits. Aucune commande possible ici. Avant toute prospection ou vente : confirmer le mandat, le tarif, l'étiquetage, les allégations et le cadre réglementaire applicable.</p>
  </div>;
}
