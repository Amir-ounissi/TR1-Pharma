import Link from "next/link";
import { CheckCircle2, MessageCircle, PackageCheck } from "lucide-react";

export default function PublicCatalogueThankYou() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-5 py-16">
      <section className="w-full rounded-2xl border border-[#dce5e9] bg-white p-7 text-center shadow-sm sm:p-10">
        <CheckCircle2 size={42} className="mx-auto text-[#2f7559]" aria-hidden="true"/>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#a35f2c]">TR1 PHARMA · Demande reçue</p>
        <h1 className="mt-3 text-3xl font-extrabold text-[#142941]">Votre sélection a bien été transmise à TR1.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#647582]">
          Il s'agit d'une demande commerciale, pas d'une commande ferme. TR1 vérifie votre sélection puis la transmet à chaque marque concernée. La marque confirme ensuite les disponibilités, les conditions définitives, la livraison et la facturation.
        </p>
        <div className="mt-7 grid gap-3 rounded-xl bg-[#f5f8f8] p-4 text-left sm:grid-cols-2">
          <p className="flex items-start gap-2 text-xs leading-5 text-[#425a6b]"><MessageCircle size={17} className="mt-0.5 shrink-0"/> TR1 reste votre interlocuteur pour le suivi et les questions.</p>
          <p className="flex items-start gap-2 text-xs leading-5 text-[#425a6b]"><PackageCheck size={17} className="mt-0.5 shrink-0"/> Chaque marque conserve la gestion de sa commande et de sa logistique.</p>
        </div>
        <Link href="/vitrine" className="mt-7 inline-flex rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white hover:bg-[#203d5a]">Retour au catalogue</Link>
      </section>
    </main>
  );
}
