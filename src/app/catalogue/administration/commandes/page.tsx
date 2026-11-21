import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  saveAgentMandate, advanceSupplierRequest, recordSupplierInvoice, advanceCommissionSettlement,
} from "./actions";

export const dynamic = "force-dynamic";

const money = (amount: number | string | null | undefined) =>
  Number(amount ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "—";
const field = "w-full rounded-lg border border-[#dce3e7] bg-white px-3 py-2.5 text-sm text-[#142941]";
const label = "block text-xs font-bold text-[#526071]";
const action = "inline-flex min-h-10 items-center justify-center rounded-lg bg-[#142941] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#213c5c]";
const transitions: Record<string, [string, string][]> = {
  received: [["verifying","En vérification"],["declined","Refuser"]],
  verifying: [["forwarded","Transmise au laboratoire"],["declined","Refuser"]],
  forwarded: [["confirmed","Confirmée par le laboratoire"],["declined","Refuser"]],
  confirmed: [["closed","Clôturer"]],
};
const statusLabel: Record<string, string> = {
  received:"Reçue",verifying:"En vérification",forwarded:"Transmise au laboratoire",
  confirmed:"Confirmée par le laboratoire",closed:"Clôturée",declined:"Refusée",
  earned:"Commission acquise",billed:"Facture TR1 émise",paid:"Payée",
};

export default async function SupplierCommissionCockpit({
  searchParams,
}: { searchParams: Promise<{ succes?: string }> }) {
  // Never send data to the client without passing the platform-admin authorization gate.
  const { supabase: admin } = await requirePlatformAdmin();
  const service = createAdminClient();
  const [
    brandsResult, pharmaciesResult, requestsResult, itemsResult,
    fulfillmentsResult, mandatesResult, commissionsResult,
  ] = await Promise.all([
    admin.from("private_catalog_brands").select("id,name,slug").order("name"),
    admin.from("private_catalog_pharmacies").select("id,name,city").order("name"),
    admin.from("private_catalog_requests")
      .select("id,pharmacy_id,brand_id,request_kind,status,created_at,total_ht")
      .order("created_at",{ascending:false}).limit(100),
    service.from("private_catalog_request_items")
      .select("request_id,product_name,sku,quantity").limit(5000),
    admin.from("private_catalog_supplier_fulfillment")
      .select("request_id,dispatch_reference,dispatched_at,confirmation_reference,confirmed_at").limit(100),
    admin.from("private_catalog_agent_mandates")
      .select("brand_id,commission_rate,first_order,repeat_order,direct_repeat,verified,contract_reference").limit(100),
    admin.from("private_catalog_agent_commissions")
      .select("id,request_id,brand_id,pharmacy_id,origin,sale_kind,supplier_invoice_reference,supplier_invoice_date,supplier_invoiced_ht,commission_rate_snapshot,commission_ht,status,tr1_invoice_reference,payment_reference,created_at")
      .order("created_at",{ascending:false}).limit(200),
  ]);
  const errors = [brandsResult.error,pharmaciesResult.error,requestsResult.error,itemsResult.error,
    fulfillmentsResult.error,mandatesResult.error,commissionsResult.error].filter(Boolean);
  if (errors.length) throw new Error("Cockpit indisponible : migration de suivi ou permissions manquantes. " + errors[0]!.message);
  const brands = brandsResult.data ?? [];
  const pharmacies = pharmaciesResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const items = itemsResult.data ?? [];
  const fulfillments = fulfillmentsResult.data ?? [];
  const mandates = mandatesResult.data ?? [];
  const commissions = commissionsResult.data ?? [];
  const mandateByBrand = new Map(mandates.map(m => [m.brand_id,m]));
  const fulfillmentByRequest = new Map(fulfillments.map(f => [f.request_id,f]));
  const brandById = new Map(brands.map(b => [b.id,b]));
  const pharmacyById = new Map(pharmacies.map(p => [p.id,p]));
  const itemsByRequest = new Map<string, typeof items>();
  for (const item of items) {
    const group = itemsByRequest.get(item.request_id) ?? [];
    group.push(item);
    itemsByRequest.set(item.request_id,group);
  }
  const outstanding = commissions.filter(c => c.status !== "paid")
    .reduce((sum,c) => sum + Number(c.commission_ht),0);
  const paid = commissions.filter(c => c.status === "paid")
    .reduce((sum,c) => sum + Number(c.commission_ht),0);
  const { succes } = await searchParams;

  return (
    <div className="space-y-7 pb-7">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#526071]">
        <Link href="/catalogue/administration" className="underline underline-offset-4">← Retour à l'administration</Link>
        <span>Accès super-administrateur uniquement</span>
      </nav>
      <header className="rounded-2xl bg-[#142941] px-6 py-7 text-white sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#ffac78]">TR1 PHARMA · Opérations commerciales</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Commandes, laboratoires et commissions</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d0dae2]">
          Suivez les demandes des officines, conservez les preuves de transmission et les confirmations des laboratoires.
          Les commissions reposent exclusivement sur les factures fournisseurs justifiées, jamais sur un panier estimatif.
        </p>
      </header>
      {succes ? <p role="status" className="rounded-lg border border-[#bed5c2] bg-[#edf7ee] p-3 text-sm font-bold text-[#315638]">Opération enregistrée : {succes}.</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Demandes reçues",requests.length.toString()],
          ["En attente laboratoire",requests.filter(r=>r.status==="forwarded").length.toString()],
          ["Commissions non réglées",money(outstanding)],
          ["Commissions encaissées",money(paid)],
        ].map(([title,value])=>(
          <div key={title} className="rounded-xl border border-[#e4e9e9] bg-white p-4">
            <p className="text-xs font-bold text-[#6c7c87]">{title}</p>
            <p className="mt-2 text-2xl font-black text-[#142941]">{value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4" aria-labelledby="supplier-requests">
        <div>
          <h2 id="supplier-requests" className="text-xl font-black text-[#142941]">1. Commandes à suivre</h2>
          <p className="mt-1 text-xs text-[#526071]">La transmission au laboratoire est manuelle : ne validez « Transmise » qu'après envoi réel, avec une référence de preuve. Une demande reçue n'est pas une commande confirmée.</p>
        </div>
        <div className="space-y-3">
          {requests.map(req=>{
            const brand=brandById.get(req.brand_id);
            const pharmacy=pharmacyById.get(req.pharmacy_id);
            const tracking=fulfillmentByRequest.get(req.id);
            const lines=itemsByRequest.get(req.id)??[];
            const targets=transitions[req.status]??[];
            const draft=[`Demande TR1 ${req.id}`,`Pharmacie : ${pharmacy?.name??"À préciser"}`,`Marque : ${brand?.name??"À préciser"}`,...lines.map(l=>`- ${l.product_name} (réf. ${l.sku}) : ${l.quantity} unités`),`Montant indicatif : ${req.total_ht===null?"à confirmer":money(req.total_ht)} HT`,`Merci de confirmer les conditions, disponibilités, montant final, et référence de commande.`].join("\n");
            return <article key={req.id} className="rounded-xl border border-[#e1e7e8] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-[#142941]">{pharmacy?.name??"Pharmacie"} · {brand?.name??"Marque"}</p>
                  <p className="mt-1 text-xs text-[#667782]">{req.id.slice(0,8).toUpperCase()} · {shortDate(req.created_at)} · {req.request_kind==="quote"?"Devis":"Commande"}</p>
                  <p className="mt-1 text-sm font-black">{req.total_ht===null?"À chiffrer":money(req.total_ht)+" HT"}</p>
                </div>
                <span className="rounded-full bg-[#f0f3f4] px-3 py-1.5 text-xs font-bold text-[#425466]">{statusLabel[req.status]??req.status}</span>
              </div>
              <details className="mt-3 rounded-lg bg-[#f7f8f7] p-3">
                <summary className="cursor-pointer text-xs font-bold text-[#31475a]">Bon de demande à copier · {lines.length} référence(s)</summary>
                <textarea readOnly rows={Math.max(5,Math.min(12,lines.length+5))}
                  aria-label={"Détail de la demande "+req.id} value={draft}
                  className="mt-3 w-full resize-y rounded-md border border-[#dce3e5] bg-white p-3 font-mono text-xs text-[#526071]" />
              </details>
              {tracking?.dispatch_reference? <p className="mt-3 text-xs text-[#536677]">Transmission : {tracking.dispatch_reference} ({shortDate(tracking.dispatched_at)})</p>:null}
              {tracking?.confirmation_reference? <p className="mt-1 text-xs text-[#536677]">Confirmation fournisseur : {tracking.confirmation_reference} ({shortDate(tracking.confirmed_at)})</p>:null}
              {targets.length>0? <form action={advanceSupplierRequest} className="mt-4 grid items-end gap-2 sm:grid-cols-[minmax(170px,1fr)_minmax(210px,1.3fr)_auto]">
                <input type="hidden" name="request_id" value={req.id}/>
                <label className={label}>Étape
                  <select name="next_status" className={field} required>{targets.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>
                </label>
                <label className={label}>Référence / preuve fournisseur
                  <input name="reference" className={field} maxLength={500} placeholder="ID email envoyé, BL, confirmation…"/>
                </label>
                <button type="submit" className={action}>Enregistrer</button>
              </form>:null}
              {["confirmed","closed"].includes(req.status) && req.request_kind==="order" && mandateByBrand.get(req.brand_id)?.verified ? (
                <details className="mt-4 rounded-xl border border-[#d9e4da] bg-[#f7faf6] p-4">
                  <summary className="cursor-pointer text-sm font-extrabold text-[#2c593c]">Enregistrer la facture fournisseur et la commission</summary>
                  <form action={recordSupplierInvoice} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="request_id" value={req.id}/>
                    <input type="hidden" name="brand_id" value={req.brand_id}/>
                    <input type="hidden" name="pharmacy_id" value={req.pharmacy_id}/>
                    <input type="hidden" name="origin" value="catalogue"/>
                    <label className={label}>Type de vente
                      <select name="sale_kind" className={field}><option value="initial">Implantation</option><option value="reorder">Réassort</option></select>
                    </label>
                    <label className={label}>Référence facture fournisseur
                      <input name="invoice_ref" className={field} required minLength={4} maxLength={120}/>
                    </label>
                    <label className={label}>Date de facture fournisseur
                      <input name="invoice_date" type="date" className={field} required max={new Date().toISOString().slice(0,10)}/>
                    </label>
                    <label className={label}>Montant HT réellement facturé
                      <input name="amount_ht" type="number" min="0.01" max="100000000" step="0.01" className={field} required/>
                    </label>
                    <label className={label+" sm:col-span-2"}>Justificatif (référence relevé / facture)
                      <input name="evidence" minLength={8} maxLength={500} className={field} required/>
                    </label>
                    <button type="submit" className={action}>Enregistrer la commission</button>
                  </form>
                </details>
              ):null}
            </article>;
          })}
          {!requests.length?<p className="rounded-xl border border-[#e1e7e8] bg-white p-6 text-sm text-[#69717d]">Aucune demande pour le moment. Le catalogue B2B reste accessible aux pharmacies autorisées.</p>:null}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="mandates">
        <div>
          <h2 id="mandates" className="text-xl font-black text-[#142941]">2. Mandats et taux de commission</h2>
          <p className="mt-1 text-xs text-[#526071]">Un taux déclaré ne devient exploitable qu'une fois son mandat documenté et vérifié. Les réassorts directs nécessitent une clause contractuelle explicite.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {brands.map(brand=>{
            const mandate=mandateByBrand.get(brand.id);
            return <form key={brand.id} action={saveAgentMandate} className="space-y-3 rounded-xl border border-[#e1e7e8] bg-white p-4">
              <input type="hidden" name="brand_id" value={brand.id}/>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold text-[#142941]">{brand.name}</h3>
                <span className={"rounded-full px-2 py-1 text-[10px] font-bold "+(mandate?.verified?"bg-[#e7f3ea] text-[#315638]":"bg-[#fff2e8] text-[#905a32]")}>
                  {mandate?.verified?"Mandat vérifié":"À documenter"}
                </span>
              </div>
              <label className={label}>Commission sur CA facturé HT (%)
                <input type="number" min="0" max="100" step="0.01" required name="commission_rate" className={field} defaultValue={mandate?.commission_rate??""}/>
              </label>
              <div className="grid gap-2 text-xs font-semibold text-[#526071] sm:grid-cols-3">
                <label className="flex items-start gap-2"><input type="checkbox" name="first_order" value="true" defaultChecked={mandate?.first_order??true}/> Implantations</label>
                <label className="flex items-start gap-2"><input type="checkbox" name="repeat_order" value="true" defaultChecked={mandate?.repeat_order??true}/> Réassorts</label>
                <label className="flex items-start gap-2"><input type="checkbox" name="direct_repeat" value="true" defaultChecked={mandate?.direct_repeat??false}/> Réassorts directs</label>
              </div>
              <label className={label}>Référence du contrat / justificatif
                <input name="contract_reference" className={field} maxLength={500} defaultValue={mandate?.contract_reference??""} placeholder="Contrat signé, article, date…"/>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-[#526071]">
                <input type="checkbox" name="verified" value="true" defaultChecked={mandate?.verified??false}/>
                Justificatif vérifié
              </label>
              <button type="submit" className={action}>Enregistrer le mandat</button>
            </form>;
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="direct-reorders">
        <h2 id="direct-reorders" className="text-xl font-black text-[#142941]">3. Réassorts directs des laboratoires</h2>
        <p className="text-xs text-[#526071]">Quand un laboratoire facture directement une pharmacie de ton portefeuille, enregistre le justificatif ici. Le calcul utilise le taux de mandat vérifié, jamais un taux modifiable dans le formulaire.</p>
        <form action={recordSupplierInvoice} className="grid gap-3 rounded-xl border border-[#e1e7e8] bg-white p-4 sm:grid-cols-2">
          <input type="hidden" name="origin" value="direct"/>
          <input type="hidden" name="sale_kind" value="reorder"/>
          <label className={label}>Marque
            <select name="brand_id" className={field} required defaultValue="">
              <option value="" disabled>Choisir une marque</option>
              {brands.filter(b=>mandateByBrand.get(b.id)?.verified && mandateByBrand.get(b.id)?.direct_repeat).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className={label}>Pharmacie
            <select name="pharmacy_id" className={field} required defaultValue="">
              <option value="" disabled>Choisir une pharmacie</option>
              {pharmacies.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?" — "+p.city:""}</option>)}
            </select>
          </label>
          <label className={label}>Facture du laboratoire
            <input name="invoice_ref" className={field} required minLength={4} maxLength={120}/>
          </label>
          <label className={label}>Date de facture
            <input name="invoice_date" type="date" className={field} required max={new Date().toISOString().slice(0,10)}/>
          </label>
          <label className={label}>CA facturé HT
            <input name="amount_ht" type="number" min="0.01" max="100000000" step="0.01" className={field} required/>
          </label>
          <label className={label}>Preuve (relevé laboratoire, PDF, rapprochement)
            <input name="evidence" className={field} minLength={8} maxLength={500} required/>
          </label>
          <button type="submit" className={action}>Enregistrer le réassort et la commission</button>
        </form>
      </section>

      <section className="space-y-4" aria-labelledby="commissions">
        <div>
          <h2 id="commissions" className="text-xl font-black text-[#142941]">4. Registre des commissions</h2>
          <p className="mt-1 text-xs text-[#526071]">Le taux est figé au moment de l'enregistrement de la facture. Le paiement doit être rapproché d'un justificatif bancaire.</p>
        </div>
        <div className="space-y-3">
          {commissions.map(c=>(
            <article key={c.id} className="rounded-xl border border-[#e1e7e8] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-[#142941]">{pharmacyById.get(c.pharmacy_id)?.name??"Pharmacie"} · {brandById.get(c.brand_id)?.name??"Marque"}</p>
                  <p className="mt-1 text-xs text-[#667782]">Facture fournisseur {c.supplier_invoice_reference} · {shortDate(c.supplier_invoice_date)} · {c.origin==="direct"?"Réassort direct":"Commande catalogue"}</p>
                  <p className="mt-2 text-xs font-semibold text-[#526071]">CA : {money(c.supplier_invoiced_ht)} HT · Taux : {Number(c.commission_rate_snapshot).toLocaleString("fr-FR")} %</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#142941]">{money(c.commission_ht)}</p>
                  <span className="text-[11px] font-bold text-[#64717e]">{statusLabel[c.status]??c.status}</span>
                </div>
              </div>
              {c.status!=="paid"?(
                <form action={advanceCommissionSettlement} className="mt-3 flex flex-wrap items-end gap-2">
                  <input name="commission_id" type="hidden" value={c.id}/>
                  <input name="next_status" type="hidden" value={c.status==="earned"?"billed":"paid"}/>
                  <label className={label+" flex-1"}>{c.status==="earned"?"Référence facture TR1":"Référence du virement encaissé"}
                    <input name="reference" className={field} minLength={4} maxLength={120} required/>
                  </label>
                  <button type="submit" className={action}>{c.status==="earned"?"Marquer facturée par TR1":"Marquer payée"}</button>
                </form>
              ):null}
            </article>
          ))}
          {!commissions.length?<p className="rounded-xl border border-[#e1e7e8] bg-white p-6 text-sm text-[#69717d]">Aucune commission documentée. Aucun montant n'est considéré acquis sans facture fournisseur et mandat validé.</p>:null}
        </div>
      </section>
    </div>
  );
}
