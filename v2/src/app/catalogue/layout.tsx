import Link from "next/link";
import { ShoppingBag, ClipboardList, LayoutGrid, LockKeyhole } from "lucide-react";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f6f8f8] text-[#142941]">
    <header className="sticky top-0 z-30 border-b border-[#e1e7e9] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Retour au site TR1 PHARMA" className="shrink-0">
            <Tr1BrandLogo className="h-10 w-20"/>
          </Link>
          <span className="hidden border-l border-[#dce3e7] pl-3 text-[11px] font-bold uppercase tracking-widest text-[#6d7f8b] sm:inline">Espace officine</span>
        </div>
        <nav aria-label="Navigation de l'espace pharmacie" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-[#40586b] sm:gap-x-6">
          <Link href="/catalogue" className="inline-flex items-center gap-1.5 hover:text-[#0e1d31]"><LayoutGrid size={15}/> Catalogue B2B</Link>
          <Link href="/catalogue/demo" className="rounded-md bg-[#fff1df] px-2.5 py-2 font-bold text-[#97521e] hover:bg-[#ffe8c8]">Vitalora · TEST</Link>
          <Link href="/catalogue/demo/panier" className="inline-flex items-center gap-1.5 hover:text-[#0e1d31]"><ShoppingBag size={15}/> Panier test</Link>
          <Link href="/catalogue/demo/demandes" className="inline-flex items-center gap-1.5 hover:text-[#0e1d31]"><ClipboardList size={15}/> Simulations</Link>
          <Link href="/catalogue/connexion" className="inline-flex items-center gap-1.5 hover:text-[#0e1d31]"><LockKeyhole size={14}/> Connexion</Link>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-8">{children}</main>
    <footer className="mx-auto mt-10 max-w-7xl border-t border-[#e1e7e9] px-5 py-7 text-xs leading-6 text-[#697782]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>TR1 PHARMA · Espace B2B réservé aux pharmacies autorisées</span>
        <span>Vitalora TEST : prix fictifs · aucune commande transmise</span>
      </div>
    </footer>
  </div>;
}
