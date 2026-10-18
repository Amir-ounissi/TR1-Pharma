import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";
import { MarketingTrackedLink } from "@/components/marketing/marketing-events";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#182824]">
      <a href="#contenu" className="sr-only z-50 rounded bg-white p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Aller au contenu</a>
      <header className="sticky top-0 z-40 border-b border-[#182824]/10 bg-[#faf9f6]/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center gap-5 px-5 sm:px-6 lg:px-10">
          <Link aria-label="TR1 Pharma — Accueil" className="flex h-12 w-[82px] shrink-0 items-center" href="/">
            <Tr1BrandLogo className="block h-12 w-[82px] shrink-0" />
          </Link>
          <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-7 text-[13px] lg:flex">
            <Link className="py-3 hover:text-[#bc4c27]" href="/#marques">L’accompagnement</Link>
            <Link className="py-3 hover:text-[#bc4c27]" href="/#terrain">À propos</Link>
            <Link className="py-3 hover:text-[#bc4c27]" href="/#pharmacies">Pharmacies</Link>
          </nav>
          <MarketingTrackedLink className="ml-auto inline-flex min-h-11 items-center gap-3 rounded-sm bg-[#182824] px-4 text-xs font-semibold text-white transition hover:bg-[#314b40] focus-visible:outline-2 focus-visible:outline-offset-4 lg:ml-4" event="primary_cta_click" href="/#contact" properties={{ placement: "header" }}>
            Nous contacter <ArrowUpRight size={15} aria-hidden="true" />
          </MarketingTrackedLink>
          <details className="relative lg:hidden">
            <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-sm border border-[#182824]/20 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">Menu</summary>
            <nav aria-label="Navigation mobile" className="absolute right-0 top-[calc(100%+.75rem)] z-50 grid w-60 gap-1 rounded border border-[#182824]/15 bg-[#faf9f6] p-2 text-sm shadow-lg">
              <Link className="rounded px-3 py-3 hover:bg-white" href="/#marques">L’accompagnement</Link>
              <Link className="rounded px-3 py-3 hover:bg-white" href="/#terrain">À propos</Link>
              <Link className="rounded px-3 py-3 hover:bg-white" href="/#pharmacies">Pharmacies</Link>
              <Link className="rounded px-3 py-3 hover:bg-white" href="/connexion">Connexion</Link>
            </nav>
          </details>
          <Link className="hidden min-h-11 items-center px-1 text-xs text-[#5d6962] hover:text-[#bc4c27] lg:inline-flex" href="/connexion">Connexion</Link>
        </div>
      </header>
      <div>{children}</div>
      <footer className="border-t border-[#182824]/15 bg-[#faf9f6] px-5 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div><Tr1BrandLogo className="block h-12 w-[82px]" /><p className="mt-4 text-xs leading-6 text-[#5d6962]">Des marques. Des officines. Une relation qui dure.<br />PACA · Gard · Hérault</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#5d6962]">
            <Link className="py-2 hover:text-[#bc4c27]" href="/connexion">Connexion</Link>
            <Link className="py-2 hover:text-[#bc4c27]" href="/mentions-legales">Mentions légales</Link>
            <Link className="py-2 hover:text-[#bc4c27]" href="/politique-de-confidentialite">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
