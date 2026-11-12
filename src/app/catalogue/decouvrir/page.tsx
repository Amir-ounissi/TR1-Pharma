import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ChartNoAxesColumnIncreasing, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Catalogue B2B multimarque | TR1 PHARMA",
  description: "Découvrez le fonctionnement du catalogue professionnel de TR1 PHARMA et demandez votre accès pharmacie.",
  robots: { index: false, follow: false },
};

const volumes = [
  { quantity: 12, band: "11–13 €" },
  { quantity: 24, band: "10–12 €" },
  { quantity: 48, band: "9–11 €" },
  { quantity: 96, band: "9–10 €" },
];

export default function CataloguePublicLanding() {
  return (
    <div className="space-y-9">
      <section className="relative overflow-hidden rounded-2xl bg-[#10253a] px-6 py-12 text-white sm:px-12 sm:py-16">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ffad76]">TR1 PHARMA · Catalogue professionnel</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-.05em] sm:text-6xl">
          Vos marques. Vos conditions. Un seul espace.
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
          Une sélection de laboratoires accompagnés sur le terrain, des conditions adaptées à votre
          officine et un parcours simple pour demander vos réassorts ou vos offres d’implantation.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/catalogue/connexion" className="inline-flex items-center gap-2 rounded-lg bg-[#ea7015] px-5 py-3 text-sm font-extrabold text-[#0e1d31]">
            Accéder à mon catalogue <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/catalogue/inscription" className="inline-flex items-center gap-2 rounded-lg border border-white/35 px-5 py-3 text-sm font-bold text-white">
            Activer une invitation
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Les avantages">
        {[
          { Icon: Building2, title: "Réservé aux pharmacies", content: "Accès nominatif après invitation et vérification de l’officine." },
          { Icon: ChartNoAxesColumnIncreasing, title: "Des paliers lisibles", content: "Repères tarifaires selon les quantités et conditions propres à votre pharmacie." },
          { Icon: PackageCheck, title: "Des demandes simplifiées", content: "Préparez un devis ou une demande de commande, puis suivez son traitement." },
        ].map(({ Icon, title, content }) => (
          <div key={title} className="rounded-xl border border-[#0e1d31]/10 bg-white p-6">
            <Icon className="text-[#bd6d3b]" size={24} aria-hidden="true" />
            <h2 className="mt-5 text-lg font-extrabold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#69717d]">{content}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-[#0e1d31]/10 bg-white p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-extrabold text-[#995228]">Illustration avec prix fictifs</span>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-[#bc6b38]">VK SWISS · Exemple de présentation</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Des fourchettes pour vous orienter.</h2>
          <p className="mt-3 text-sm leading-7 text-[#69717d]">
            Une pharmacie invitée voit une indication de prix HT selon ses volumes. Un accord contractuel
            peut ensuite afficher des prix exacts, réservés exclusivement à son compte.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-[#0e1d31]/10">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f7f8] px-5 py-4">
              <strong className="text-sm">Sérum visage · référence fictive</strong>
              <span className="text-xs font-bold text-[#ab6334]">9–13 € HT / unité</span>
            </div>
            {volumes.map((row) => (
              <div key={row.quantity} className="flex items-center justify-between gap-3 border-t border-[#0e1d31]/10 px-5 py-3.5 text-sm">
                <span className="text-[#69717d]">À partir de {row.quantity} unités</span>
                <strong>{row.band} HT / unité</strong>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#87919b]">
            Cet exemple ne constitue ni un tarif VK SWISS réel ni une offre commerciale ferme.
            Les tarifs publiés seront configurés et validés par les laboratoires partenaires.
          </p>
        </div>

        <aside className="rounded-xl bg-[#e9edf0] p-6 sm:p-8">
          <LockKeyhole size={25} className="text-[#10253a]" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-black tracking-tight">Vos prix restent privés.</h2>
          <p className="mt-3 text-sm leading-7 text-[#607081]">
            Aucune pharmacie ne peut voir les conditions négociées par une autre.
            Le prix de référence interne du laboratoire n’est jamais affiché aux visiteurs.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-white p-4 text-sm leading-6">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#327553]" size={19} aria-hidden="true" />
            Accès professionnel contrôlé, par officine et par marque.
          </div>
          <Link href="/catalogue/connexion" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold underline">
            Ouvrir mon espace professionnel <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </div>
  );
}
