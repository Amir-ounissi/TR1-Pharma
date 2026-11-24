import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { saveBrandCommissionAction,addBrandBonusAction,deleteDraftBonusAction } from "./actions";
import { CommissionPreview } from "./preview";

const baseLabels:{[key:string]:string}={
  undetermined:"À préciser",
  order_ht:"Commande HT",
  invoiced_ht:"Facturation HT",
  collected_ht:"Montant HT encaissé",
  net_ht_after_discounts:"CA net HT après remises",
};
const triggerLabels:{[key:string]:string}={
  undetermined:"À préciser",order_validated:"Validation de commande",
  invoice_issued:"Émission de facture",payment_collected:"Encaissement client",
};
const typeLabels:{[key:string]:string}={fixed:"Forfait €",per_unit:"€ par unité",percent:"% de l'assiette"};

export default async function CommissionsAdmin({searchParams}:{searchParams:Promise<{enregistre?:string;prime?:string}>}) {
  const {db}=await requireOwner();
  const params=await searchParams;
  const [brandsResult,commResult,bonusesResult,programResult]=await Promise.all([
    db.from("brands").select("id,name,slug").in("slug",["vitalora","bloomster","noto"]).order("name"),
    db.from("brand_commission_settings").select("*"),
    db.from("brand_bonus_rules").select("*").order("created_at",{ascending:false}),
    db.from("althesia_commercial_program").select("*").eq("id","althesia").maybeSingle(),
  ]);
  if(brandsResult.error||commResult.error||bonusesResult.error||programResult.error)
    throw new Error("Impossible de charger les commissions Althesia.");
  const brands=brandsResult.data??[],comm=commResult.data??[],bonuses=bonusesResult.data??[];
  const program=programResult.data;
  return <div className="space-y-7 pb-10">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#a55925]">Gestion TR1 · Confidentiel</p>
      <h1 className="mt-2 text-3xl font-bold">Commissions & primes Althesia</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#697782]">
        Un paramétrage indépendant par marque. Les commissions ne sont visibles que dans le cockpit propriétaire,
        jamais sur les fiches des pharmacies.
      </p>
    </header>
    {params.enregistre==="1"||params.prime==="1"?<p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Paramétrage sauvegardé dans la V2.</p>:null}
    <section className="grid gap-3 sm:grid-cols-3">
      {[
        ["Marques Althesia",brands.length],
        ["Commissions en brouillon",comm.filter(x=>x.review_status==="draft").length],
        ["Primes réellement documentées",bonuses.filter(x=>x.review_status==="confirmed").length],
      ].map(([label,n])=><div key={label} className="rounded-xl border bg-white p-5">
        <p className="text-xs font-semibold text-[#667885]">{label}</p>
        <p className="mt-3 text-3xl font-extrabold">{n}</p>
      </div>)}
    </section>

    <section className="rounded-xl border border-[#eadac6] bg-[#fff8ed] p-5 text-sm leading-6 text-[#85572d]">
      <strong>Source EasyVRP : 15 % sur les références produit des trois gammes.</strong>
      <p className="mt-2">L'assiette, le fait générateur, la date d'effet, le bénéficiaire contractuel et d'éventuelles primes d'implantation ne sont pas définis dans le fichier transmis. Les règles sont donc préremplies <strong>en brouillon</strong>, sans calcul automatique de créance.</p>
      <p className="mt-2 text-xs">Source : Althesia_EasyVRP.xlsx, colonnes « Commission » et « Type Commission ».</p>
    </section>

    {brands.map(b=>{
      const c=comm.find(x=>x.brand_id===b.id),existing=bonuses.filter(x=>x.brand_id===b.id);
      return <section key={b.id} className="overflow-hidden rounded-xl border bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#f7f9fa] px-6 py-5">
          <div><h2 className="text-xl font-bold">{b.name}</h2>
            <p className="mt-1 text-xs text-[#788692]">{existing.length} prime(s) configurée(s)</p></div>
          <span className="rounded-md bg-[#fff1df] px-3 py-1 text-xs font-semibold text-[#9e5a21]">
            {c?.review_status==="confirmed"?"Contrat validé":"À confirmer"}
          </span>
        </header>
        {c?<div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_275px]">
          <div>
            <form action={saveBrandCommissionAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="brand_id" value={b.id}/>
              <label className="grid gap-1.5 text-xs font-semibold">Taux de commission (%)
                <input name="rate_percent" type="number" min="0" max="100" step=".001" defaultValue={Number(c.rate_percent??0)}
                  required className="rounded-lg border bg-white p-3 text-sm"/></label>
              <label className="grid gap-1.5 text-xs font-semibold">Bénéficiaire
                <input name="beneficiary" defaultValue={c.beneficiary??""} maxLength={200} required
                  className="rounded-lg border bg-white p-3 text-sm"/></label>
              <label className="grid gap-1.5 text-xs font-semibold">Assiette contractuelle
                <select name="base_type" defaultValue={c.base_type} className="rounded-lg border bg-white p-3 text-sm">
                  {Object.entries(baseLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </select></label>
              <label className="grid gap-1.5 text-xs font-semibold">Fait générateur
                <select name="trigger_event" defaultValue={c.trigger_event} className="rounded-lg border bg-white p-3 text-sm">
                  {Object.entries(triggerLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </select></label>
              <label className="grid gap-1.5 text-xs font-semibold">Date d'effet
                <input name="effective_from" type="date" defaultValue={c.effective_from??""}
                  className="rounded-lg border bg-white p-3 text-sm"/></label>
              <label className="grid gap-1.5 text-xs font-semibold">Référence justificative
                <input name="confirmation_reference" defaultValue={c.confirmation_reference??""}
                  placeholder="Contrat signé, avenant, confirmation écrite…" className="rounded-lg border bg-white p-3 text-sm"/></label>
              <label className="grid gap-1.5 text-xs font-semibold md:col-span-2">Notes / exclusions / rétrocommissions
                <textarea name="notes" rows={3} defaultValue={c.notes??""} maxLength={2000}
                  className="rounded-lg border bg-white p-3 text-sm"/></label>
              <div className="space-y-3 md:col-span-2">
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input type="checkbox" name="confirm" value="yes" defaultChecked={c.review_status==="confirmed"} className="mt-1"/>
                  Je confirme l'assiette, le déclencheur et le justificatif contractuel.
                </label>
                <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Enregistrer {b.name}</button>
              </div>
            </form>
          </div>
          <CommissionPreview rate={Number(c.rate_percent??0)} confirmed={c.review_status==="confirmed"}/>
        </div>:<p className="p-6 text-sm text-[#7d8892]">Règle de commission à initialiser.</p>}

        <div className="border-t bg-[#fafbfb] p-6">
          <h3 className="text-base font-bold">Primes et bonus de la marque</h3>
          <p className="mt-1 text-xs leading-5 text-[#72828e]">Aucune prime d'implantation, d'objectif ou de réassort n'a été définie dans les documents fournis. Ajoute-la uniquement si la marque l'a confirmée.</p>
          {existing.length?<div className="mt-3 space-y-2">
            {existing.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3 text-xs">
              <div><strong>{x.title}</strong><p className="mt-1 text-[#6a7b88]">{Number(x.amount).toLocaleString("fr-FR")} {x.bonus_type==="percent"?"%":"€"} · {typeLabels[x.bonus_type]} · {x.review_status==="confirmed"?"Confirmée":"Brouillon"}</p></div>
              {x.review_status==="draft"?<form action={deleteDraftBonusAction}>
                <input type="hidden" name="bonus_id" value={x.id}/><button className="text-[#ac4c25] underline">Supprimer le brouillon</button>
              </form>:null}
            </div>)}
          </div>:<p className="mt-3 text-xs italic text-[#7b8b96]">Aucune prime enregistrée pour {b.name}.</p>}
          <form action={addBrandBonusAction} className="mt-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
            <input type="hidden" name="brand_id" value={b.id}/>
            <label className="grid gap-1 text-xs font-semibold">Intitulé de la prime
              <input name="title" placeholder="Ex. implantation initiale" required minLength={3}
                className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Mode
              <select name="bonus_type" className="rounded-lg border bg-white p-2.5 text-sm">
                <option value="fixed">Montant fixe €</option><option value="per_unit">€ / unité</option><option value="percent">% de l'assiette</option>
              </select></label>
            <label className="grid gap-1 text-xs font-semibold">Montant / taux
              <input name="amount" type="number" min="0" step=".01" required className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Seuil CA HT (facultatif)
              <input name="threshold_ht" type="number" min="0" step=".01" className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Seuil unités (facultatif)
              <input name="threshold_units" type="number" min="0" step="1" className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Date de début
              <input name="effective_from" type="date" className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Date de fin (facultative)
              <input name="effective_until" type="date" className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Document source
              <input name="source_document" placeholder="Contrat / email / annexe" className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold">Référence de validation
              <input name="confirmation_reference" placeholder="Document signé..." className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="grid gap-1 text-xs font-semibold md:col-span-3">Conditions de déclenchement
              <textarea name="event_condition" rows={2} placeholder="Objectif, période, vente encaissée, conditions d'éligibilité…" className="rounded-lg border p-2.5 text-sm"/></label>
            <label className="flex items-start gap-2 text-xs font-semibold md:col-span-3">
              <input name="confirm" value="yes" type="checkbox" className="mt-1"/>Prime confirmée par une pièce justificative (sinon brouillon)
            </label>
            <button className="rounded-lg border border-[#142941] px-4 py-3 text-xs font-bold text-[#142941] hover:bg-[#f4f7f8] md:col-span-3">
              Ajouter la prime de {b.name}
            </button>
          </form>
        </div>
      </section>;
    })}

    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-bold">Conditions commerciales des pharmacies — séparées des commissions TR1</h2>
      <p className="mt-2 text-sm text-[#73828f]">Elles sont issues du catalogue Althesia et ne doivent pas être saisies comme des primes d'agent.</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <p className="rounded-lg bg-[#f4f7f8] p-4"><strong>Remises multimarques :</strong> 2 marques {program?.multi_2_pct??2.5}% · 3 marques {program?.multi_3_pct??5}% (minimum de 500 € / marque / an selon le catalogue)</p>
        <p className="rounded-lg bg-[#f4f7f8] p-4"><strong>Franco :</strong> 1 marque {program?.freight_1_ht??200} € · 2 marques {program?.freight_2_ht??300} € · 3 marques {program?.freight_3_ht??400} € HT</p>
      </div>
      <p className="mt-4 text-xs text-[#758591]">Les remises annuelles sur CA N-1 figurent dans le document source : 2 %, 3 %, 5 %, 7 % selon seuil. Aucun calcul d'éligibilité automatique tant que les ventes et le périmètre contractuel ne sont pas vérifiés.</p>
      <Link href="/app/althesia" className="mt-4 inline-block text-sm font-semibold underline">Voir le contrôle documentaire Althesia</Link>
    </section>
  </div>;
}
