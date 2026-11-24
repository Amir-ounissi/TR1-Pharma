import Link from "next/link";
import {ArrowRight,Building2,Compass,PackageCheck,ShieldCheck} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";

export default async function PharmacyHome() {
  const {brands}=await loadPharmacyBrandDirectory();
  const installed=brands.filter(b=>b.status==="implanted");
  const other=brands.filter(b=>b.status!=="implanted");
  return <div className="space-y-7 pb-12">
    <div className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e8b180]">TR1 PHARMA · ESPACE OFFICINE</p>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Votre espace marques</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dce4ea]">Deux parcours adaptés à votre officine : suivre les marques déjà référencées ou découvrir de nouvelles gammes à implanter.</p>
    </div>
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
      <Link href="/catalogue/mes-demandes" className="rounded-lg border border-[#d4dde2] px-4 py-3 text-sm font-semibold text-[#284d65]">Historique des demandes</Link>
    </section>
    <div className="flex items-start gap-3 rounded-xl border border-[#ebdfca] bg-[#fff9ef] p-4 text-xs leading-5 text-[#795b3b]">
      <ShieldCheck size={18} className="mt-0.5 shrink-0"/>
      <p>TR1 PHARMA agit en tant qu'intermédiaire commercial. Les demandes de présentation ne constituent pas des commandes. Le référencement réel et l'accès au catalogue sont deux paramètres distincts.</p>
    </div>
  </div>;
}
