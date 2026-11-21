import Link from "next/link";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";
export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#faf9f6] text-[#0e1d31]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
      <Link href="/" aria-label="Retour au site TR1"><Tr1BrandLogo className="h-12 w-24"/></Link>
      <nav aria-label="Navigation pharmacie" className="flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/catalogue">Catalogue B2B</Link>
        <Link href="/catalogue/mes-demandes">Mes demandes</Link>
        <Link href="/catalogue/connexion">Connexion pharmacie</Link>
      </nav>
    </div></header>
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">{children}</main>
    <footer className="mx-auto mt-8 max-w-7xl border-t px-5 py-6 text-xs text-[#69717d]">TR1 PHARMA · Catalogue réservé aux professionnels autorisés · Prix hors taxes</footer>
  </div>;
}
