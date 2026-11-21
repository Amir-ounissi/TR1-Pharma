import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, ShoppingBasket } from "lucide-react";
import { PublicProductGrid } from "@/components/catalogue/public-product-grid";

export const metadata: Metadata = {
  title: "Catalogue professionnel multimarque | TR1 PHARMA",
  description: "Explorez les gammes Beauty of Joseon, Dr. Althea, Biodance et Vitalora dans le catalogue professionnel TR1 PHARMA.",
  robots: { index: false, follow: false },
};

export default function PharmacieStorefront() {
  return (
    <div className="-mt-3 space-y-6 pb-4 sm:-mt-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e7ec] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#b3683e]">TR1 PHARMA · Sélection multimarque</p>
          <h1 className="mt-1 text-xl font-black tracking-[-.035em] text-[#0e1d31] sm:text-2xl">Catalogue professionnel</h1>
          <p className="mt-1 text-xs leading-5 text-[#66717d]">Parcourez les produits et filtrez par marque, catégorie ou référence.</p>
        </div>
        <Link href="/catalogue/demander-acces"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#142941] px-3.5 text-xs font-extrabold text-white hover:bg-[#1e405f]">
          Demander un accès <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <PublicProductGrid />

      <section aria-labelledby="customer-benefits" className="grid gap-4 rounded-lg bg-white p-6 shadow-sm sm:grid-cols-3 sm:p-7">
        <h2 id="customer-benefits" className="sr-only">Services pour votre pharmacie</h2>
        {[
          { Icon: Building2, title: "Sélection pour votre officine", description: "Retrouvez les marques et références accessibles à votre pharmacie." },
          { Icon: ShoppingBasket, title: "Commande par quantités", description: "Composez votre panier et consultez vos paliers avant de transmettre une demande." },
          { Icon: ClipboardList, title: "Suivi des demandes", description: "Retrouvez l’historique de vos demandes de prix et de réassort dans votre espace." },
        ].map(({ Icon, title, description }) => (
          <div key={title} className="flex gap-3 py-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#fff1e6] text-[#162a45]"><Icon size={19} aria-hidden="true" /></div>
            <div><h3 className="text-sm font-extrabold text-[#0e1d31]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#69717d]">{description}</p></div>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-[#f4f0e7] px-6 py-8 sm:px-9">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#515d6b]">Votre espace pharmacie</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#0e1d31]">Connectez-vous pour consulter vos tarifs.</h2>
          <p className="mt-2 text-sm text-[#515d6b]">Votre accès est lié aux marques et aux conditions accordées à votre officine.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalogue/connexion" className="shop-secondary-action inline-flex min-h-11 items-center gap-2 px-5 text-sm">
            Connexion pro <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/catalogue/demander-acces" className="inline-flex min-h-11 items-center rounded-lg bg-[#ea7015] px-5 text-sm font-extrabold text-[#0e1d31] hover:bg-[#f28331]">
            Demander l’accès au catalogue
          </Link>
          <Link href="/catalogue/inscription" className="inline-flex min-h-11 items-center rounded-lg border border-[#dce3ea] px-5 text-sm font-bold text-[#0e1d31]">
            Activer mon invitation
          </Link>
        </div>
      </section>

    </div>
  );
}
