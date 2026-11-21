import Link from "next/link";
import {
  ArrowRight, CalendarClock, Check, ClipboardList, Coins, Eye,
  Package, PhoneCall, Plus, Settings2, Store, Tags,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth";
import { completeSoloAgentFollowup, planSoloAgentFollowup } from "./suivi-actions";

export const dynamic = "force-dynamic";

const money = (value: number) =>
  value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const shortDate = (date: string | null | undefined) =>
  date ? new Date(date.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR") : "—";

const actionLabels: Record<string,string> = {
  visit: "Visite", call: "Appel", email: "Email", reorder: "Réassort",
  animation: "Animation",
};
const requestLabels: Record<string,string> = {
  received:"Demande reçue",verifying:"À vérifier",forwarded:"En attente du laboratoire",
  confirmed:"Confirmée",closed:"Clôturée",declined:"Refusée",
};
const field = "min-h-10 w-full rounded-lg border border-[#dce3e7] bg-white px-3 py-2 text-sm text-[#142941] outline-none focus:border-[#c58152]";
const label = "block space-y-1.5 text-xs font-bold text-[#5e6d7a]";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#142941] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#254b6a]";

type Priority = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  category: string;
  urgency: number;
};

export default async function SoloAgentHome({
  searchParams,
}: { searchParams: Promise<{ pharmacie?: string; succes?: string }> }) {
  const { supabase } = await requirePlatformAdmin();
  const [
    pharmaciesResult, brandsResult, accessResult, requestsResult,
    commissionsResult, followupsResult, mandatesResult,
  ] = await Promise.all([
    supabase.from("private_catalog_pharmacies").select("id,name,city,created_at")
      .order("name").limit(800),
    supabase.from("private_catalog_brands").select("id,name,active").order("name"),
    supabase.from("private_catalog_access").select("pharmacy_id,brand_id,active"),
    supabase.from("private_catalog_requests")
      .select("id,pharmacy_id,brand_id,request_kind,status,total_ht,created_at")
      .order("created_at",{ascending:false}).limit(600),
    supabase.from("private_catalog_agent_commissions")
      .select("id,brand_id,pharmacy_id,commission_ht,supplier_invoiced_ht,status,created_at")
      .order("created_at",{ascending:false}).limit(600),
    supabase.from("private_catalog_agent_followups")
      .select("id,pharmacy_id,brand_id,action_kind,next_action_date,note,status")
      .eq("status","todo").order("next_action_date",{ascending:true}).limit(300),
    supabase.from("private_catalog_agent_mandates").select("brand_id,verified"),
  ]);
  const error = pharmaciesResult.error ?? brandsResult.error ?? accessResult.error ??
    requestsResult.error ?? commissionsResult.error ?? followupsResult.error ?? mandatesResult.error;
  if (error) throw new Error("Tableau de bord indisponible : " + error.message);
  const pharmacies = pharmaciesResult.data ?? [];
  const brands = brandsResult.data ?? [];
  const access = (accessResult.data ?? []).filter(row=>row.active);
  const requests = requestsResult.data ?? [];
  const commissions = commissionsResult.data ?? [];
  const followups = followupsResult.data ?? [];
  const mandates = mandatesResult.data ?? [];
  const today = new Date().toISOString().slice(0,10);
  const { pharmacie, succes } = await searchParams;
  const selectedPharmacy = pharmacies.some(p=>p.id===pharmacie) ? pharmacie : "";

  const brandById = new Map(brands.map(b=>[b.id,b.name]));
  const pharmacyById = new Map(pharmacies.map(p=>[p.id,p.name]));
  const latestRequestByPharmacy = new Map<string,typeof requests[number]>();
  for (const request of requests) {
    if (!latestRequestByPharmacy.has(request.pharmacy_id)) latestRequestByPharmacy.set(request.pharmacy_id,request);
  }
  const brandCounts = new Map<string,number>();
  for (const entry of access) brandCounts.set(entry.pharmacy_id,(brandCounts.get(entry.pharmacy_id)??0)+1);
  const followupByPharmacy = new Map<string,typeof followups[number]>();
  for (const followup of followups) {
    if (!followupByPharmacy.has(followup.pharmacy_id)) followupByPharmacy.set(followup.pharmacy_id,followup);
  }
  const pending = requests.filter(r=>["received","verifying","forwarded"].includes(r.status));
  const unpaid = commissions.filter(c=>c.status!=="paid");
  const invoicedTracked = commissions.reduce((total,c)=>total+Number(c.supplier_invoiced_ht),0);
  const commissionOwed = unpaid.reduce((total,c)=>total+Number(c.commission_ht),0);
  const commissionPaid = commissions.filter(c=>c.status==="paid")
    .reduce((total,c)=>total+Number(c.commission_ht),0);
  const verifiedBrands = new Set(mandates.filter(m=>m.verified).map(m=>m.brand_id));
  const dueFollowups = followups.filter(f=>f.next_action_date<=today);
  const priorities:Priority[] = [
    ...dueFollowups.slice(0,8).map(f=>({
      key:"followup-"+f.id,
      title:(actionLabels[f.action_kind]??"Action")+" · "+(pharmacyById.get(f.pharmacy_id)??"Pharmacie"),
      subtitle:(f.next_action_date<today?"En retard depuis le ":"Prévu le ")+shortDate(f.next_action_date)+
        (f.brand_id?" · "+(brandById.get(f.brand_id)??"Marque"):"")+
        (f.note?" · "+f.note:""),
      href:"#actions",category:"Terrain",urgency:f.next_action_date<today?0:1,
    })),
    ...pending.slice(0,8).map(r=>({
      key:"request-"+r.id,
      title:(requestLabels[r.status]??"Demande")+" · "+(pharmacyById.get(r.pharmacy_id)??"Pharmacie"),
      subtitle:(brandById.get(r.brand_id)??"Marque")+" · "+shortDate(r.created_at),
      href:"/catalogue/administration/commandes#supplier-requests",
      category:"Commande",urgency:r.status==="forwarded"?2:1,
    })),
    ...unpaid.slice(0,6).map(c=>({
      key:"commission-"+c.id,
      title:(c.status==="earned"?"Commission à facturer":"Commission à encaisser")+" · "+(brandById.get(c.brand_id)??"Marque"),
      subtitle:(pharmacyById.get(c.pharmacy_id)??"Pharmacie")+" · "+money(Number(c.commission_ht)),
      href:"/catalogue/administration/commandes#commissions",
      category:"Commission",urgency:3,
    })),
  ].sort((a,b)=>a.urgency-b.urgency).slice(0,12);

  return (
    <div className="-mt-4 space-y-6 pb-6 sm:-mt-7">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#142941] px-5 py-5 text-white sm:px-7">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ffb784]">TR1 PHARMA · Mon espace commercial</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Mon activité</h1>
          <p className="mt-1 text-xs leading-5 text-[#cbd8e3]">Mes pharmacies, mes commandes, mes relances et mes commissions. Un seul tableau de bord.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="#planifier" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-black text-[#142941] hover:bg-[#f5eee8]">
            <Plus size={15} aria-hidden="true"/> Planifier une action
          </Link>
          <Link href="/catalogue/administration/configuration" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/40 px-3.5 text-xs font-bold text-white hover:bg-white/10">
            <Settings2 size={15} aria-hidden="true"/> Réglages
          </Link>
        </div>
      </header>

      {succes ? <p role="status" className="rounded-lg border border-[#c9e1ce] bg-[#eff8f0] px-4 py-3 text-sm font-bold text-[#315d3a]">
        {succes==="terminee"?"Action marquée terminée.":"Action planifiée."}
      </p> : null}

      <section aria-label="Mon catalogue B2B privé" className="grid gap-3 md:grid-cols-2">
        <Link href="/catalogue/administration/configuration"
          className="group flex items-start justify-between gap-3 rounded-xl border border-[#dfe6e8] bg-white p-5 transition hover:border-[#bbccd5] hover:shadow-sm">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-[#b06f47]">
              <Settings2 size={16} aria-hidden="true" /> Catalogue privé
            </p>
            <h2 className="mt-2 text-lg font-black text-[#142941]">Gérer mon catalogue</h2>
            <p className="mt-1 text-xs leading-5 text-[#6b7c89]">Produits, marques, visuels, publication, prix professionnels et accès des pharmacies.</p>
            <p className="mt-3 text-xs font-extrabold text-[#284963]">Ouvrir la gestion</p>
          </div>
          <ArrowRight size={19} aria-hidden="true" className="mt-2 shrink-0 text-[#81939f] group-hover:translate-x-1" />
        </Link>
        <Link href="/catalogue/administration/apercu-catalogue"
          className="group flex items-start justify-between gap-3 rounded-xl border border-[#dfe6e8] bg-white p-5 transition hover:border-[#bbccd5] hover:shadow-sm">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-[#b06f47]">
              <Eye size={16} aria-hidden="true"/> Catalogue privé
            </p>
            <h2 className="mt-2 text-lg font-black text-[#142941]">Visualiser mon catalogue</h2>
            <p className="mt-1 text-xs leading-5 text-[#6b7c89]">Aperçu des fiches et tarifs, en vue générale ou avec les accès d&apos;une pharmacie précise.</p>
            <p className="mt-3 text-xs font-extrabold text-[#284963]">Ouvrir l&apos;aperçu sécurisé</p>
          </div>
          <ArrowRight size={19} aria-hidden="true" className="mt-2 shrink-0 text-[#81939f] group-hover:translate-x-1"/>
        </Link>
      </section>

      <section aria-label="Mes indicateurs" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {title:"Mes pharmacies",value:String(pharmacies.length),detail:"Officines du catalogue TR1",icon:Store},
          {title:"Commandes à suivre",value:String(pending.length),detail:"Demandes catalogue en cours",icon:ClipboardList},
          {title:"Commissions à percevoir",value:money(commissionOwed),detail:"Facturées ou à facturer par TR1",icon:Coins},
          {title:"Actions terrain à faire",value:String(dueFollowups.length),detail:"À réaliser aujourd'hui ou en retard",icon:CalendarClock},
        ].map(kpi=>(
          <div key={kpi.title} className="rounded-xl border border-[#e0e5e8] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#667582]">{kpi.title}</p>
              <kpi.icon size={17} aria-hidden="true" className="shrink-0 text-[#8596a4]"/>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-[#102740] sm:text-[28px]">{kpi.value}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#798591]">{kpi.detail}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="priority-actions" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(250px,0.6fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-[#e0e5e8] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edef] px-4 py-4 sm:px-5">
            <div>
              <h2 id="priority-actions" className="text-lg font-black text-[#142941]">À traiter en priorité</h2>
              <p className="mt-1 text-xs text-[#798591]">Actions issues des données TR1, sans rendez-vous ni commandes inventés.</p>
            </div>
            <Link href="#actions" className="text-xs font-bold text-[#a35f3c] underline underline-offset-4">Mes relances</Link>
          </div>
          {priorities.length?(
            <div className="divide-y divide-[#edf0f1]">
              {priorities.map(item=>(
                <Link key={item.key} href={item.href} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#f7f9f8] sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#22364b]">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#6f7d88]">{item.subtitle}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#7a8791]">
                    <span className="hidden sm:inline">{item.category}</span><ArrowRight size={15} aria-hidden="true"/>
                  </span>
                </Link>
              ))}
            </div>
          ):<div className="p-6 text-sm text-[#657687]">
            Aucune urgence enregistrée dans le catalogue TR1. Planifiez un appel ou une visite pour alimenter votre suivi terrain.
          </div>}
        </div>
        <div className="rounded-xl border border-[#e0e5e8] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black text-[#142941]">Accès rapide</h2>
          <div className="mt-4 grid gap-2">
            {[
              {href:"#pharmacies",label:"Mes pharmacies",icon:Store},
              {href:"/catalogue/administration/commandes#supplier-requests",label:"Commandes et fournisseurs",icon:Package},
              {href:"/catalogue/administration/commandes#commissions",label:"Mes commissions",icon:Coins},
              {href:"/catalogue/administration/apercu-catalogue",label:"Visualiser le catalogue privé",icon:Eye},
              {href:"/catalogue/administration/configuration",label:"Gérer le catalogue privé",icon:Settings2},
              {href:"/catalogue/decouvrir",label:"Catalogue public",icon:Tags},
            ].map(item=>(
              <Link key={item.href} href={item.href} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[#e6ebed] px-3.5 text-xs font-extrabold text-[#304458] hover:bg-[#f5f7f6]">
                <span className="flex items-center gap-2"><item.icon size={16} aria-hidden="true"/>{item.label}</span>
                <ArrowRight size={15} aria-hidden="true"/>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-[#f5f7f6] p-3 text-xs leading-5 text-[#596c79]">
            <p className="font-bold text-[#142941]">Mes ventes suivies</p>
            <p>CA HT facturé et rapproché : <strong>{money(invoicedTracked)}</strong></p>
            <p>Commissions encaissées : <strong>{money(commissionPaid)}</strong></p>
            <p>Mandats validés : <strong>{verifiedBrands.size}</strong> / {brands.length} marques enregistrées</p>
            <p className="mt-2 text-[11px]">Ces chiffres proviennent uniquement des factures saisies dans TR1, pas des ventes externes non importées.</p>
          </div>
        </div>
      </section>

      <section id="pharmacies" aria-labelledby="portfolio" className="overflow-hidden rounded-xl border border-[#e0e5e8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edef] px-4 py-4 sm:px-5">
          <div>
            <h2 id="portfolio" className="text-lg font-black text-[#142941]">Mon portefeuille pharmacies</h2>
            <p className="mt-1 text-xs text-[#75838f]">Dernières demandes du catalogue TR1 uniquement. Les commandes réalisées hors plateforme ne sont pas encore synchronisées.</p>
          </div>
          <Link href="/catalogue/administration/configuration#setup" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#a35f3c] underline underline-offset-4">
            <Plus size={14} aria-hidden="true"/> Ajouter une officine
          </Link>
        </div>
        <div className="divide-y divide-[#edf0f1]">
          {pharmacies.map(p=>{
            const latest=latestRequestByPharmacy.get(p.id);
            const next=followupByPharmacy.get(p.id);
            return <article key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div>
                <p className="text-sm font-extrabold text-[#20364b]">{p.name}</p>
                <p className="mt-1 text-xs text-[#71808c]">{p.city??"Ville non renseignée"} · {brandCounts.get(p.id)??0} marque(s) autorisée(s)</p>
                <p className="mt-1 text-[11px] text-[#7a8792]">{latest?"Dernière demande : "+shortDate(latest.created_at)+" · "+(requestLabels[latest.status]??latest.status):"Aucune demande enregistrée dans ce catalogue"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-[#63737f]">{next?"Prochaine action : "+shortDate(next.next_action_date):"Relance non planifiée"}</span>
                <Link href={"/catalogue/administration/apercu-catalogue?pharmacie="+encodeURIComponent(p.id)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#ccd9df] px-3 text-xs font-extrabold text-[#142941] hover:bg-[#f2f7f7]">
                  <Eye size={14} aria-hidden="true"/> Voir le catalogue
                </Link>
                <Link href={"/catalogue/administration/apercu-catalogue?pharmacie="+encodeURIComponent(p.id)+"&mode=simulation"}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#d9dec4] bg-[#f6f8ee] px-3 text-xs font-extrabold text-[#3c5543] hover:bg-[#eef4e6]">
                  <ClipboardList size={14} aria-hidden="true"/> Simuler un panier
                </Link>
                <Link href={"/catalogue/administration?pharmacie="+encodeURIComponent(p.id)+"#planifier"}
                  className="inline-flex min-h-9 items-center rounded-lg border border-[#ccd9df] px-3 text-xs font-extrabold text-[#142941] hover:bg-[#f2f7f7]">Planifier</Link>
              </div>
            </article>;
          })}
          {!pharmacies.length?<div className="p-6 text-sm text-[#63717e]">Aucune officine dans ce catalogue. Ajoutez votre premier client depuis les réglages.</div>:null}
        </div>
      </section>

      <section id="actions" aria-labelledby="my-actions" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.85fr)]">
        <div className="rounded-xl border border-[#e0e5e8] bg-white p-4 sm:p-5">
          <h2 id="my-actions" className="text-lg font-black text-[#142941]">Mon suivi terrain</h2>
          <p className="mt-1 text-xs text-[#75838f]">Appels, visites, emails, animations et relances de réassort que vous avez programmés.</p>
          <div className="mt-4 space-y-2">
            {followups.slice(0,18).map(f=>(
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e8ecef] p-3">
                <div>
                  <p className="text-sm font-bold text-[#20364b]">{actionLabels[f.action_kind]??"Action"} · {pharmacyById.get(f.pharmacy_id)??"Pharmacie"}</p>
                  <p className="mt-1 text-[11px] text-[#6f7d88]">{shortDate(f.next_action_date)}{f.next_action_date<today?" · En retard":""}{f.brand_id?" · "+(brandById.get(f.brand_id)??"Marque"):""}</p>
                  {f.note?<p className="mt-1 max-w-xl text-xs text-[#657687]">{f.note}</p>:null}
                </div>
                <form action={completeSoloAgentFollowup}>
                  <input type="hidden" name="followup_id" value={f.id}/>
                  <button type="submit" aria-label={"Marquer terminée : "+(actionLabels[f.action_kind]??"action")+" "+(pharmacyById.get(f.pharmacy_id)??"")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#bed4c6] px-3 text-xs font-bold text-[#28623b] hover:bg-[#eef6ee]">
                    <Check size={15} aria-hidden="true"/> Fait
                  </button>
                </form>
              </div>
            ))}
            {!followups.length?<p className="rounded-lg bg-[#f6f8f7] p-4 text-sm text-[#697885]">Aucune action planifiée. Créez votre prochaine relance dans le formulaire.</p>:null}
          </div>
        </div>

        <form id="planifier" action={planSoloAgentFollowup} className="scroll-mt-6 space-y-3 rounded-xl border border-[#e0e5e8] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <PhoneCall size={18} aria-hidden="true" className="text-[#a96e4b]"/>
            <h2 className="text-lg font-black text-[#142941]">Planifier une action</h2>
          </div>
          <label className={label}>Pharmacie
            <select name="pharmacy_id" required className={field} defaultValue={selectedPharmacy}>
              <option value="" disabled>Choisir une officine</option>
              {pharmacies.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?" — "+p.city:""}</option>)}
            </select>
          </label>
          <label className={label}>Marque concernée (facultatif)
            <select name="brand_id" className={field} defaultValue="">
              <option value="">Toutes les marques</option>
              {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Action
              <select name="action_kind" className={field} defaultValue="call">
                <option value="call">Appel</option>
                <option value="visit">Visite</option>
                <option value="email">Email</option>
                <option value="reorder">Réassort</option>
                <option value="animation">Animation</option>
              </select>
            </label>
            <label className={label}>Date
              <input name="next_action_date" type="date" className={field} required defaultValue={today}/>
            </label>
          </div>
          <label className={label}>Objectif / note (facultatif)
            <textarea name="note" maxLength={500} rows={3} className={field} placeholder="Ex. rappeler le titulaire pour réassort des nouveautés" />
          </label>
          <button type="submit" disabled={!pharmacies.length} className={primary+" w-full disabled:opacity-40"}>
            <Plus size={15} aria-hidden="true"/> Enregistrer la relance
          </button>
        </form>
      </section>
      <p className="text-[11px] leading-5 text-[#778593]">
        Vue personnelle TR1 PHARMA. Les données du catalogue ne comprennent pas automatiquement les visites CRM, les commandes HubSpot ou le sell-out externe ; aucune activité absente du système n&apos;est inventée.
      </p>
    </div>
  );
}
