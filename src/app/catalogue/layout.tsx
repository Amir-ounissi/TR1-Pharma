import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";

export const metadata: Metadata = {
  title: "Catalogue professionnel privé | TR1 PHARMA",
  description: "Espace professionnel réservé aux pharmacies invitées.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrivateCatalogueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f0e7] text-[#0e1d31]">
      <header className="border-b border-[#0e1d31]/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/catalogue" className="inline-flex items-center gap-4">
            <Tr1BrandLogo className="h-12 w-20 shrink-0" />
            <span className="hidden border-l border-[#0e1d31]/15 pl-4 text-xs font-semibold uppercase tracking-[.14em] sm:block">
              Catalogue professionnel
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-xs font-bold sm:text-sm" aria-label="Espace pharmacie">
            <Link href="/catalogue" className="hover:text-[#ea7015]">Marques</Link>
            <Link href="/catalogue/mes-demandes" className="hover:text-[#ea7015]">Mes demandes</Link>
            <Link href="/catalogue/connexion" className="inline-flex items-center gap-1 rounded-md border border-[#0e1d31]/15 px-3 py-2 hover:border-[#ea7015]">
              <LockKeyhole size={14} aria-hidden="true" /> Accès privé
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
      <footer className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-3 border-t border-[#0e1d31]/10 px-5 py-7 text-xs text-[#69717d] sm:px-8">
        <p>TR1 PHARMA · Du sell-in au sell-out</p>
        <p>Accès strictement réservé aux pharmacies invitées · Prix HT</p>
      </footer>
    </div>
  );
}
