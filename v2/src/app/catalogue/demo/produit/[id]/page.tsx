import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, Package, ShieldAlert, Truck, Calculator, ClipboardCheck } from "lucide-react";
import { requireVitaloraDemo } from "@/lib/vitalora-demo";
import { demoMoney } from "@/lib/demo-display";
import { DemoQuantityForm } from "@/components/demo/demo-quantity-form";

type Params = { params:Promise<{id:string}> };
export default async function VitaloraDemoDetail({params}:Params) {
  const {id}=await params;
  const {db,authorized,brandId}=await requireVitaloraDemo();
  if(!authorized)return <section className="rounded-xl border bg-white p-8">
    <h1 className="text-2xl font-bold">Fiche non accessible</h1>
    <p className="mt-2 text-sm text-[#69717d]">Accès au pilote Vitalora non autorisé pour cette pharmacie.</p>
  </section>;
  const [p,t]=await Promise.all([
    db.from("demo_products").select("id,name,sku,ean,format,category,description,image_url,demo_price_ht,min_qty,qty_step")
      .eq("id",id).eq("brand_id",brandId).eq("active",true).maybeSingle(),
    db.from("demo_price_tiers").select("min_qty,price_ht").eq("product_id",id).order("min_qty"),
  ]);
  if(p.error||t.error)throw new Error("Impossible de charger la fiche de démonstration.");
  if(!p.data)notFound();
  const x=p.data,tiers=t.data??[];
  return <div className="space-y-6 pb-14">
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-xs text-[#627482]">
      <Link href="/catalogue/demo" className="hover:underline">Catalogue Vitalora</Link><span>/</span>
      <span>{x.category||"Produits"}</span><span>/</span><span className="font-semibold text-[#142941]">{x.name}</span>
    </nav>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/catalogue/demo" className="inline-flex items-center gap-2 text-sm font-semibold text-[#142941] hover:underline">
        <ArrowLeft size={17}/> Tous les produits
      </Link>
      <Link href="/catalogue/demo/panier" className="text-sm font-semibold text-[#1b4864] underline underline-offset-2">Voir le panier test</Link>
    </div>
    <div className="rounded-xl border border-[#e8d9bd] bg-[#fff9ed] px-4 py-3 text-xs leading-5 text-[#875423]">
      <strong>Produit de démonstration.</strong> Les prix sont fictifs. La composition provient d'un ancien catalogue,
      sans validation réglementaire ni commerciale pour la France. Aucune commande fournisseur possible.
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-[#e2e7e9] bg-white">
          <div className="relative flex h-[340px] items-center justify-center bg-[#f9faf9] px-12 py-8 sm:h-[420px]">
            <span className="absolute left-5 top-5 rounded-md border border-[#e8d5ba] bg-[#fff9ed] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#90501e]">Mode TEST</span>
            {x.image_url?<img src={x.image_url} alt={`Visuel ${x.name}`} className="h-full max-w-full object-contain"/>:
              <Package size={55} className="text-[#92a0a9]" aria-hidden="true"/>}
          </div>
          <div className="border-t border-[#e7ecee] px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#627586]">VITALORA · {x.category||"Compléments alimentaires"}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#142941]">{x.name}</h1>
            <p className="mt-2 text-sm text-[#687986]">{x.format||"Conditionnement à confirmer"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-[#eff3f5] px-3 py-1.5 font-mono text-xs text-[#42596a]">EAN {x.ean||"Non renseigné"}</span>
              <span className="rounded-md bg-[#eff3f5] px-3 py-1.5 font-mono text-xs text-[#42596a]">Réf. {x.sku}</span>
            </div>
          </div>
        </section>

        <section id="conseil" className="rounded-2xl border border-[#e2e7e9] bg-white p-6">
          <div className="flex items-center gap-2"><ClipboardCheck size={20} className="text-[#385d75]"/><h2 className="text-lg font-bold text-[#142941]">Composition et informations produit</h2></div>
          <p className="mt-2 text-xs text-[#74828d]">Extrait du catalogue source, à confirmer sur l'étiquette et auprès de Vitalora.</p>
          <div className="mt-4 rounded-xl bg-[#f6f8f9] p-5 text-sm leading-7 text-[#364d5e]">
            {x.description||"Les ingrédients et dosages n'ont pas été communiqués dans la fiche source."}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["Conseils d'utilisation","Non renseignés dans la source disponible"],
              ["Précautions / contre-indications","À vérifier sur l'étiquette officielle"],
              ["Liste complète des ingrédients","Non fournie dans la source disponible"],
              ["Public concerné","À confirmer par la marque"],
            ].map(([label,value])=><div key={label} className="border-t border-[#e8edee] pt-3">
              <h3 className="text-xs font-bold text-[#243f55]">{label}</h3>
              <p className="mt-1 text-xs leading-5 text-[#71818c]">{value}</p>
            </div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e2e7e9] bg-white p-6">
          <div className="flex items-center gap-2"><ShieldAlert size={20} className="text-[#385d75]"/><h2 className="text-lg font-bold text-[#142941]">Qualité, documents et aide à la vente</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Étiquetage français","Validation en attente"],
              ["Justificatif réglementaire","Non renseigné"],
              ["Allégations et arguments conseil","Non validés"],
              ["Fiche PDF / PLV","Document non disponible"],
            ].map(([label,value])=><div key={label} className="rounded-lg border border-[#e8edee] p-4">
              <FileText size={17} className="text-[#8093a0]" aria-hidden="true"/>
              <p className="mt-3 text-sm font-semibold text-[#213a50]">{label}</p>
              <p className="mt-1 text-xs text-[#75838e]">{value}</p>
            </div>)}
          </div>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-5">
        <section className="rounded-2xl border border-[#d7e1e6] bg-white p-6 shadow-[0_8px_32px_rgb(14_29_49/0.07)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a5a2b]">Conditions d'achat fictives</p>
          <p className="mt-4 text-xs text-[#6c7e8a]">Prix de base HT / unité</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#142941]">{demoMoney(x.demo_price_ht)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {tiers.map(t=><div key={t.min_qty} className="rounded-lg border border-[#e5ebee] bg-[#f7f9fa] px-2 py-3 text-center">
              <p className="text-xs text-[#667987]">Dès {t.min_qty} u.</p>
              <p className="mt-1 text-sm font-extrabold tabular-nums text-[#142941]">{demoMoney(t.price_ht)}</p>
              <p className="mt-0.5 text-[10px] text-[#71808c]">HT / u.</p>
            </div>)}
          </div>
          <div className="my-5 border-t border-[#e6ebee]"/>
          <DemoQuantityForm productId={x.id} basePrice={x.demo_price_ht}
            tiers={tiers} minQty={x.min_qty} qtyStep={x.qty_step} variant="detail"/>
          <p className="mt-3 text-center text-[11px] leading-4 text-[#7a8791]">Ajout au panier fictif uniquement · aucun paiement</p>
        </section>

        <section className="rounded-2xl border border-[#e2e7e9] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#142941]"><Calculator size={17}/> Analyse commerciale</h2>
          <div className="mt-4 divide-y divide-[#edf0f1] text-sm">
            {[
              ["PVC TTC","Non communiqué / non validé"],
              ["Marge officinale","Non calculable sans PVC"],
              ["Remises / UG","Paliers fictifs uniquement"],
            ].map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-3 py-3">
              <span className="text-[#60717e]">{label}</span>
              <strong className="text-right text-xs text-[#253e54]">{value}</strong>
            </div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-[#e2e7e9] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#142941]"><Truck size={17}/> Logistique</h2>
          <p className="mt-3 text-sm text-[#6d7c87]">Disponibilité, franco, frais de port et délai de livraison : <strong>non confirmés</strong>.</p>
          <Link href="/catalogue/demo" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b4864] hover:underline">Comparer d'autres produits <ArrowUpRight size={14}/></Link>
        </section>
      </aside>
    </div>
  </div>;
}
