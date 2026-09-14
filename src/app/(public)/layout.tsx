import Link from "next/link";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";
import { MarketingTrackedLink } from "@/components/marketing/marketing-events";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffdf8] text-[#0b1e32]">
      <header className="sticky top-0 z-40 border-b border-[#0b1e32]/10 bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.6rem] max-w-7xl items-center gap-4 px-5 lg:px-8">
          <Link aria-label="TR1 Pharma — Accueil" className="flex shrink-0 items-center" href="/">
            <Tr1BrandLogo className="h-12 w-auto shrink-0" />
          </Link>

          <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-[#445265] lg:flex">
            <Link className="transition hover:text-[#c84f24]" href="/#plateforme">La plateforme</Link>
            <Link className="transition hover:text-[#c84f24]" href="/#animations-formations">Animations & formations</Link>
            <Link className="transition hover:text-[#c84f24]" href="/#pourquoi-tr1">Pourquoi TR1</Link>
          </nav>

          <MarketingTrackedLink
            className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-xl bg-[#c84f24] px-4 font-mono text-[.64rem] font-black uppercase tracking-[.06em] text-white shadow-[0_10px_24px_rgba(200,79,36,.18)] transition hover:-translate-y-0.5 hover:bg-[#b64620] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1e32] focus-visible:ring-offset-2 lg:ml-2"
            event="primary_cta_click"
            href="/#diagnostic"
            properties={{ placement: "header" }}
          >
            Demander une démo
          </MarketingTrackedLink>

          <details className="relative lg:hidden">
            <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-xl border border-[#0b1e32]/15 bg-white/80 px-3 font-mono text-[.64rem] font-black uppercase tracking-[.06em] outline-none focus-visible:ring-2 focus-visible:ring-[#c84f24]">Menu</summary>
            <nav className="absolute right-0 top-[calc(100%+.5rem)] z-50 grid w-60 gap-1 rounded-2xl border border-[#0b1e32]/10 bg-[#fffdf8] p-2 text-sm font-semibold shadow-[0_20px_50px_rgba(7,20,33,.14)]">
              <Link className="rounded-xl px-3 py-2.5 hover:bg-white" href="/#plateforme">La plateforme</Link>
              <Link className="rounded-xl px-3 py-2.5 hover:bg-white" href="/#animations-formations">Animations & formations</Link>
              <Link className="rounded-xl px-3 py-2.5 hover:bg-white" href="/#pourquoi-tr1">Pourquoi TR1</Link>
              <Link className="rounded-xl px-3 py-2.5 text-[#667384] hover:bg-white" href="/connexion">Connexion</Link>
            </nav>
          </details>

          <Link className="hidden min-h-11 items-center rounded-xl border border-[#0b1e32]/15 px-4 font-mono text-[.64rem] font-black uppercase tracking-[.05em] text-[#0b1e32] transition hover:border-[#c84f24]/35 hover:text-[#c84f24] lg:inline-flex" href="/connexion">Connexion</Link>
        </div>
      </header>

      <div className="bg-[#fffdf8] [background-image:linear-gradient(rgba(11,30,50,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(11,30,50,.025)_1px,transparent_1px)] [background-size:30px_30px]">
        {children}
      </div>

      <footer className="border-t border-[#0b1e32]/10 bg-[#fffdf8] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Tr1BrandLogo className="h-14 w-auto" />
            <p className="mt-3 max-w-md text-sm leading-6 text-[#667384]">Pilotage commercial et coordination des actions terrain en pharmacie.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[.66rem] font-bold uppercase tracking-[.06em] text-[#667384]">
            <Link className="hover:text-[#c84f24]" href="/connexion">Connexion</Link>
            <Link className="hover:text-[#c84f24]" href="/mentions-legales">Mentions légales</Link>
            <Link className="hover:text-[#c84f24]" href="/politique-de-confidentialite">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
