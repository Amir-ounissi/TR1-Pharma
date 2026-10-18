import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";
import { MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { MobilePublicNav } from "@/components/marketing/mobile-public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#142739]">
      <a href="#contenu" className="sr-only z-50 rounded bg-white p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Aller au contenu</a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101d2d]/97 text-[#f6fbfc] backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[1348px] items-center gap-4 px-[18px] sm:px-8 lg:px-11">
          <Link aria-label="TR1 Pharma — Accueil" className="flex h-16 w-[96px] shrink-0 items-center" href="/">
            <Tr1BrandLogo primaryColor="#f5fafb" accentColor="#b9edcf" className="block h-[58px] w-[96px] shrink-0" />
          </Link>
          <div className="ml-0 hidden h-8 w-px bg-white/15 lg:ml-2 lg:block" aria-hidden="true" />
          <p className="hidden text-[10px] font-semibold uppercase tracking-[.14em] text-[#9caebb] xl:block">Développement commercial en pharmacie</p>
          <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-8 text-[13px] font-medium text-[#d4e0e4] lg:flex">
            <Link className="py-3 transition hover:text-[#b9edcf]" href="/#marques">Notre approche</Link>
            <Link className="py-3 transition hover:text-[#b9edcf]" href="/#terrain">Notre expertise</Link>
            <Link className="py-3 transition hover:text-[#b9edcf]" href="/#pharmacies">Pharmacies</Link>
          </nav>
          <MarketingTrackedLink className="ml-auto inline-flex min-h-11 items-center gap-3 rounded-md bg-[#b9edcf] px-4 text-xs font-bold text-[#14273a] transition hover:bg-[#dbf9e8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b9edcf] lg:ml-3" event="primary_cta_click" href="/#contact" properties={{ placement: "header" }}>
            Nous contacter <ArrowUpRight size={16} aria-hidden="true" />
          </MarketingTrackedLink>
          <MobilePublicNav />
          <Link className="hidden min-h-11 items-center px-1 text-xs text-[#b7c8d1] transition hover:text-white lg:inline-flex" href="/connexion">Connexion</Link>
        </div>
      </header>
      <div>{children}</div>
      <footer className="border-t border-white/10 bg-[#101d2d] px-[18px] py-12 text-[#e8f0f1] sm:px-8 lg:px-11">
        <div className="mx-auto flex max-w-[1260px] flex-col gap-9 md:flex-row md:items-end md:justify-between">
          <div>
            <Tr1BrandLogo primaryColor="#f5fafb" accentColor="#b9edcf" className="block h-[58px] w-[96px]" />
            <p className="mt-4 text-xs leading-6 text-[#b2c7cc]">Prospection. Implantation. Développement.<br/>PACA · Gard · Hérault</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-[#b2c7cc]">
            <Link className="py-2 transition hover:text-white" href="/connexion">Connexion</Link>
            <Link className="py-2 transition hover:text-white" href="/mentions-legales">Mentions légales</Link>
            <Link className="py-2 transition hover:text-white" href="/politique-de-confidentialite">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
