import Link from "next/link";
import {ArrowRight,Building2,Compass,PackageCheck,ShieldCheck,MessageCircle,Calendar,GraduationCap,FileText} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";
import {announcementCategoryLabel} from "@/lib/communication-labels";

export default async function PharmacyHome() {
  const {brands,db,user}=await loadPharmacyBrandDirectory();
  const [newsResult,readsResult,resourcesResult]=await Promise.all([
    db.from("tr1_announcements").select("id,title,summary,category,brand_id,published_at").eq("status","published").order("published_at",{ascending:false}).limit(3),
    db.from("tr1_announcement_reads").select("announcement_id").eq("user_id",user.id),
    db.from("tr1_resources").select("id",{count:"exact",head:true}).eq("published",true),
  ]);
  if(newsResult.error||readsResult.error||resourcesResult.error)throw new Error("Impossible de charger les communications TR1.");
  const news=newsResult.data??[],seen=new Set((readsResult.data??[]).map(x=>x.announcement_id));
  const installed=brands.filter(b=>b.status==="implanted");
  const other=brands.filter(b=>b.status!=="implanted");
  return <div className="space-y-7 pb-12">
    <div className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e8b180]">TR1 PHARMA · ESPACE OFFICINE</p>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Votre partenaire commercial au quotidien</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dce4ea]">Retrouvez vos marques, découvrez les nouveautés et sollicitez votre interlocuteur TR1 pour tout besoin commercial ou accompagnement de votre équipe.</p>
    </div>
    <section className="rounded-2xl border border-[#d9e2e6] bg-white p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-extrabold"><MessageCircle size={22}/> Mon interlocuteur TR1</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7a86]">Une question, un projet de référencement, un besoin de formation ou un litige ? Échangez directement avec TR1 et suivez vos demandes dans un espace unique. Vous pouvez déposer une demande à tout moment.</p></div><Link href="/catalogue/contact" className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Contacter TR1</Link></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{[{label:"Prendre rendez-vous",category:"appointment",Icon:Calendar},{label:"Formation / animation",category:"training",Icon:GraduationCap},{label:"Documentation / PLV",category:"resources",Icon:FileText}].map(({label,category,Icon})=><Link key={category} href={"/catalogue/contact?type="+category} className="flex items-center gap-2 rounded-xl border p-4 text-sm font-semibold hover:bg-[#f6f8f8]"><Icon size={18}/>{label}</Link>)}</div>
    </section>
    <section className="space-y-4 rounded-2xl border border-[#d9e2e6] bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#9c5a29]">Votre fil d'information</p><h2 className="mt-1 text-xl font-extrabold">Actualités et opportunités</h2><p className="mt-1 text-sm text-[#6b7a86]">Les nouveautés et opérations concernant votre officine.</p></div><Link href="/catalogue/actualites" className="text-sm font-bold underline">{news.filter(x=>!seen.has(x.id)).length} non lue(s) · Tout voir</Link></div>
      {news.length?<div className="grid gap-3 md:grid-cols-3">{news.map(x=><Link key={x.id} href={"/catalogue/actualites#"+x.id} className="rounded-xl border p-4 hover:bg-[#f7f9fa]"><div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-[#59768a]">{announcementCategoryLabel(x.category)}</span>{!seen.has(x.id)&&<span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-[10px] font-bold text-[#92521e]">Nouveau</span>}</div><h3 className="mt-2 font-bold">{x.title}</h3><p className="mt-2 line-clamp-3 text-xs leading-5 text-[#697b87]">{x.summary}</p></Link>)}</div>:<p className="rounded-lg bg-[#f6f8f8] p-4 text-sm text-[#697b87]">Aucune actualité disponible pour le moment.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><p className="text-xs text-[#6b7a86]">{resourcesResult.count??0} ressource(s) documentaire(s) disponibles</p><Link href="/catalogue/ressources" className="text-sm font-semibold text-[#1a526f] underline">Ouvrir la bibliothèque</Link></div>
    </section>
    <div className="grid gap-5 md:grid-cols-2">
      <Link href="/catalogue/mes-marques" className="group rounded-2xl border border-[#d9e2e6] bg-white p-7 shadow-[0_5px_20px_rgb(14_29_49/0.045)] transition hover:border-[#93afbd] hover:shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-xl bg-[#e7eff3] p-3 text-[#183d53]"><Building2 size={26}/></div>
          <span className="text-3xl font-extrabold text-[#142941]">{installed.length}</span>
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-[#142941]">Mes marques implantées</h2>
        <p className="mt-2 min-h-16 text-sm leading-6 text-[#6b7a86]">Consulter les marques déjà référencées dans l'officine, retrouver leurs produits et préparer les demandes de réassort lorsqu'elles sont disponibles.</p>
        <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#1a506d]">Accéder à mes marques <ArrowRight size={17} className="transition group-hover:translate-x-1"/></div>
      </Link>
      <Link href="/catalogue/decouvrir" className="group rounded-2xl border border-[#e5ddcc] bg-[#fffcf6] p-7 shadow-[0_5px_20px_rgb(14_29_49/0.045)] transition hover:border-[#d0b78d] hover:shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-xl bg-[#f7ecd9] p-3 text-[#9c5a29]"><Compass size={26}/></div>
          <span className="text-3xl font-extrabold text-[#142941]">{other.length}</span>
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-[#142941]">Découvrir de nouvelles marques</h2>
        <p className="mt-2 min-h-16 text-sm leading-6 text-[#6b7a86]">Explorer les gammes non référencées ou dont l'implantation reste à confirmer, consulter les fiches disponibles et demander une présentation.</p>
        <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#9c5a29]">Explorer les marques <ArrowRight size={17} className="transition group-hover:translate-x-1"/></div>
      </Link>
    </div>
    <section className="grid gap-4 rounded-xl border border-[#e1e8eb] bg-white p-6 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-[#142941]"><PackageCheck size={18}/> Marques suivies</h2>
        <p className="mt-2 text-sm text-[#6a7a85]">{installed.length?installed.map(x=>x.name).join(" · "):"Aucune marque officiellement renseignée comme implantée."}</p>
        <p className="mt-2 text-xs text-[#71818c]">Votre statut d'implantation est tenu à jour par TR1, indépendamment des accès au catalogue test.</p>
      </div>
      <Link href="/catalogue/mes-demandes" className="rounded-lg border border-[#d4dde2] px-4 py-3 text-sm font-semibold text-[#284d65]">Mes demandes de commande</Link>
    </section>
    <div className="flex items-start gap-3 rounded-xl border border-[#ebdfca] bg-[#fff9ef] p-4 text-xs leading-5 text-[#795b3b]">
      <ShieldCheck size={18} className="mt-0.5 shrink-0"/>
      <p>TR1 PHARMA est votre interlocuteur commercial. Les demandes de commande sont contrôlées puis transmises à la marque concernée. Celle-ci assure la disponibilité, la livraison et la facturation des produits.</p>
    </div>
  </div>;
}
