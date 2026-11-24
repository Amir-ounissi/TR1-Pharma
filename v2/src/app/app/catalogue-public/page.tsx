import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { ExternalLink, Mail, Store } from "lucide-react";
import { updatePublicCatalogueRequestAction } from "./actions";

const labels: Record<string,string> = {
  received: "Reçue", verifying: "À vérifier", forwarded: "Transmise à la marque",
  confirmed: "Confirmée par la marque", closed: "Clôturée", declined: "Refusée",
};
const nextStatuses: Record<string,string[]> = {
  received: ["verifying","declined"], verifying: ["forwarded","declined"],
  forwarded: ["confirmed","declined"], confirmed: ["closed"], closed: [], declined: [],
};
const euro = (value: number | string) => Number(value).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});

export default async function PublicCatalogueRequestsPage() {
  const { db } = await requireOwner();
  const [requests,leads,brands,items,terms] = await Promise.all([
    db.from("public_catalogue_requests").select("id,lead_id,brand_id,status,total_ht,admin_note,forwarded_at,created_at").order("created_at",{ascending:false}).limit(100),
    db.from("public_catalogue_leads").select("id,pharmacy_name,contact_name,email,phone,city,postal_code,siret,note,matched_pharmacy_id,created_at").order("created_at",{ascending:false}).limit(100),
    db.from("brands").select("id,name,slug"),
    db.from("public_catalogue_request_items").select("request_id,product_name,brand_name,sku,quantity,unit_price_ht,line_total_ht,vat_rate").limit(500),
    db.from("brand_trade_terms").select("brand_id,order_email,verified"),
  ]);
  if ([requests,leads,brands,items,terms].some(x=>x.error)) throw new Error("Impossible de charger les demandes du catalogue public.");

  const leadById = new Map((leads.data??[]).map(x=>[x.id,x]));
  const brandById = new Map((brands.data??[]).map(x=>[x.id,x]));
  const termsByBrand = new Map((terms.data??[]).map(x=>[x.brand_id,x]));
  const itemsByRequest = new Map<string, any[]>();
  for (const item of items.data??[]) {
    const rows = itemsByRequest.get(item.request_id) ?? [];
    rows.push(item);
    itemsByRequest.set(item.request_id,rows);
  }
  const rows = requests.data??[];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#a35f2c]">Prospection · Catalogue partageable</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[#142941]">Demandes du catalogue public</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687b88]">Chaque demande est séparée par marque. Vérifie les coordonnées et les quantités, puis transmets manuellement la demande au fournisseur concerné.</p>
      </div>
      <Link href="/vitrine" target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white"><ExternalLink size={15}/> Ouvrir le catalogue public</Link>
    </header>

    <section className="rounded-xl border border-[#dce5e9] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[#617b8c]">Lien à partager aux prospects</p>
      <p className="mt-2 break-all font-mono text-sm font-semibold text-[#142941]">https://www.tr1pharma.com/vitrine</p>
      <p className="mt-2 text-xs leading-5 text-[#6b7b87]">Accès libre, sans création de compte. Les prospects peuvent consulter les références publiées, constituer un panier multimarque et transmettre une demande à TR1.</p>
    </section>

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Demandes par marque",rows.length],
        ["Prospects identifiés",(leads.data??[]).length],
        ["À traiter",rows.filter(x=>x.status==="received"||x.status==="verifying").length],
      ].map(([label,count])=><div key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold text-[#6b7b87]">{String(label)}</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-[#142941]">{String(count)}</p></div>)}
    </div>

    <section className="space-y-4">
      {rows.length ? rows.map(request => {
        const lead = leadById.get(request.lead_id);
        const brand = brandById.get(request.brand_id);
        const brandTerms = termsByBrand.get(request.brand_id);
        const lines = itemsByRequest.get(request.id) ?? [];
        const supplierEmail = brandTerms?.verified ? brandTerms.order_email : null;
        const mailSubject = "Demande de commande officine · " + (brand?.name ?? "Marque") + " · " + (lead?.pharmacy_name ?? "Pharmacie");
        const mailBody = [
          "Bonjour,",
          "",
          "Veuillez trouver ci-dessous une demande commerciale transmise par TR1 PHARMA.",
          "Pharmacie : " + (lead?.pharmacy_name ?? "—"),
          "Contact : " + (lead?.contact_name ?? "—"),
          "Ville : " + [lead?.postal_code,lead?.city].filter(Boolean).join(" "),
          "SIRET : " + (lead?.siret ?? "Non communiqué"),
          "",
          ...lines.map(x=>"- " + x.product_name + " (" + x.sku + ") : " + x.quantity + " u. × " + euro(x.unit_price_ht) + " HT = " + euro(x.line_total_ht) + " HT"),
          "",
          "Total indicatif HT : " + euro(request.total_ht),
          "",
          "Merci de confirmer la disponibilité, les conditions définitives, la livraison et la facturation directement à l'officine.",
          "TR1 PHARMA reste l'intermédiaire commercial et le point de contact terrain.",
        ].join("\n");
        const mailHref = supplierEmail ? "mailto:" + supplierEmail + "?subject=" + encodeURIComponent(mailSubject) + "&body=" + encodeURIComponent(mailBody) : null;
        const options = [request.status,...(nextStatuses[request.status]??[])];

        return <article key={request.id} className="rounded-xl border border-[#dce5e9] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#718695]">{brand?.name ?? "Marque"}</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#142941]">{lead?.pharmacy_name ?? "Pharmacie inconnue"}</h2>
              <p className="mt-1 text-xs text-[#6c7d88]">Demande {request.id.slice(0,8).toUpperCase()} · {new Date(request.created_at).toLocaleString("fr-FR")}</p>
            </div>
            <div className="text-right"><p className="text-xl font-extrabold text-[#142941]">{euro(request.total_ht)} HT</p><span className="mt-1 inline-block rounded-full bg-[#edf2f4] px-3 py-1 text-[11px] font-bold text-[#496477]">{labels[request.status]??request.status}</span></div>
          </div>

          {lead ? <div className="mt-4 grid gap-2 rounded-lg bg-[#f7f9f9] p-4 text-sm sm:grid-cols-2">
            <p><strong>Contact :</strong> {lead.contact_name}</p>
            <p><strong>E-mail :</strong> <a className="underline" href={"mailto:" + lead.email}>{lead.email}</a></p>
            <p><strong>Téléphone :</strong> {lead.phone || "Non communiqué"}</p>
            <p><strong>Ville :</strong> {[lead.postal_code,lead.city].filter(Boolean).join(" ")}</p>
            <p><strong>SIRET :</strong> {lead.siret || "Non communiqué"}</p>
            <p><strong>Rattachement :</strong> {lead.matched_pharmacy_id ? "Pharmacie déjà identifiée par SIRET" : "Prospect à qualifier"}</p>
            {lead.note ? <p className="sm:col-span-2"><strong>Précision :</strong> {lead.note}</p> : null}
          </div> : null}

          <div className="mt-4 divide-y border-y">
            {lines.map((line:any,i:number)=><div key={i} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div><p className="font-semibold text-[#253f52]">{line.product_name}</p><p className="mt-1 text-xs text-[#74838d]">{line.sku} · {line.quantity} unité(s) · TVA {Number(line.vat_rate)} %</p></div>
              <div className="text-right"><p className="font-bold">{euro(line.line_total_ht)} HT</p><p className="text-xs text-[#74838d]">{euro(line.unit_price_ht)} / unité</p></div>
            </div>)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {mailHref ? <a href={mailHref} className="inline-flex items-center gap-2 rounded-lg bg-[#eaf2f4] px-4 py-2.5 text-xs font-bold text-[#244e66]"><Mail size={15}/> Préparer l'e-mail fournisseur</a>
              : <Link href={"/app/conditions?marque="+request.brand_id} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold text-[#526b7b]">Renseigner l'e-mail fournisseur</Link>}
            <span className="text-xs text-[#71818b]">{supplierEmail ? "Destinataire vérifié : " + supplierEmail : "Aucune adresse fournisseur vérifiée"}</span>
          </div>

          <form action={updatePublicCatalogueRequestAction} className="mt-5 grid gap-3 rounded-lg border border-[#e4e9eb] p-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
            <input type="hidden" name="request_id" value={request.id}/>
            <label className="grid gap-1 text-xs font-semibold text-[#536b7a]">Suivi
              <select name="status" defaultValue={request.status} className="h-10 rounded-lg border bg-white px-2 text-sm">{options.map(s=><option key={s} value={s}>{labels[s]??s}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#536b7a]">Note interne
              <input name="admin_note" defaultValue={request.admin_note??""} maxLength={2000} className="h-10 rounded-lg border px-3 text-sm"/>
            </label>
            <button className="h-10 rounded-lg bg-[#142941] px-4 text-xs font-bold text-white">Enregistrer</button>
            {request.status==="verifying" ? <label className="flex items-start gap-2 text-xs text-[#647987] md:col-span-3"><input type="checkbox" name="transmission_confirmed" value="yes" className="mt-0.5"/>J'ai réellement transmis cette demande à la marque (obligatoire pour passer au statut « Transmise »).</label> : null}
            {request.status==="received" ? <p className="text-[11px] text-[#74838d] md:col-span-3">Passe d'abord la demande à « À vérifier », puis confirme la transmission après l'envoi au fournisseur.</p> : null}
          </form>
          {request.forwarded_at ? <p className="mt-3 text-xs text-[#71818b]">Transmission enregistrée le {new Date(request.forwarded_at).toLocaleString("fr-FR")}</p> : null}
          {request.admin_note ? <p className="mt-2 text-xs text-[#647987]"><strong>Note interne :</strong> {request.admin_note}</p> : null}
        </article>;
      }) : <div className="rounded-xl border border-dashed bg-white p-8 text-center"><Store size={30} className="mx-auto text-[#82939d}"/><h2 className="mt-3 font-bold text-[#142941]">Aucune demande pour le moment</h2><p className="mt-2 text-sm text-[#6c7d88]">Les demandes envoyées depuis le lien public apparaîtront ici, séparées par marque.</p></div>}
    </section>
    <p className="text-xs leading-5 text-[#71818b]">La préparation d'un e-mail ouvre votre messagerie ; aucun e-mail n'est envoyé automatiquement. La marque reste responsable de la confirmation, de la facturation et de la logistique.</p>
  </div>;
}
