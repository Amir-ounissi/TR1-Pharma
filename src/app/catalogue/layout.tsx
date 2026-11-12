import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, ShoppingBag, Store } from "lucide-react";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";

export const metadata: Metadata = {
  title: "Catalogue professionnel | TR1 PHARMA",
  description: "Catalogue B2B multimarque pour pharmacies : produits, tarifs professionnels et demandes de réassort.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrivateCatalogueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tr1-catalogue min-h-screen bg-[#faf9f6] text-[#0e1d31]">
      <header className="border-b border-[#e2e7ec] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/catalogue/decouvrir" className="inline-flex items-center gap-3" aria-label="TR1 PHARMA — Accueil catalogue">
            <Tr1BrandLogo className="h-12 w-20 shrink-0" />
            <span className="hidden border-l border-[#e2e7ec] pl-4 text-xs font-bold uppercase tracking-[.13em] text-[#0e1d31] sm:block">
              Catalogue professionnel
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-extrabold sm:gap-5 sm:text-sm" aria-label="Navigation du catalogue">
            <Link href="/catalogue/decouvrir" className="inline-flex items-center gap-1.5 p-2 hover:text-[#ad4b08]">
              <Store size={16} aria-hidden="true" /> <span className="hidden sm:inline">Découvrir</span><span className="sm:hidden">Boutique</span>
            </Link>
            <Link href="/catalogue" className="inline-flex items-center gap-1.5 p-2 hover:text-[#ad4b08]">
              <ShoppingBag size={16} aria-hidden="true" /> Mes produits
            </Link>
            <Link href="/catalogue/mes-demandes" className="p-2 hover:text-[#ad4b08]">Mes demandes</Link>
            <Link href="/catalogue/connexion" className="inline-flex items-center gap-1.5 rounded-md border border-[#dce3ea] px-3 py-2.5 hover:bg-[#edf3ee]">
              <LockKeyhole size={15} aria-hidden="true" /> Connexion pro
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
      <footer className="mx-auto mt-10 flex max-w-7xl flex-wrap justify-between gap-3 border-t border-[#e2e7ec] px-5 py-7 text-xs text-[#78877d] sm:px-8">
        <p className="font-bold text-[#0e1d31]">TR1 PHARMA · Catalogue professionnel</p>
        <p>Produits réservés aux pharmacies et parapharmacies · Prix exprimés en HT</p>
      </footer>
    </div>
  );
}
