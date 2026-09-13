import Link from "next/link";
import { MarketingTrackedLink } from "@/components/marketing/marketing-events";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--tr1-ivory)] text-[var(--tr1-navy)]">
      <header className="sticky top-0 z-40 border-b border-[var(--tr1-line)] bg-[var(--tr1-ivory)]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.75rem] max-w-7xl items-center gap-3 px-5 py-2 lg:px-8">
          <Link aria-label="TR1 Pharma — Accueil" className="flex shrink-0 items-center" href="/">
            <img alt="TR1 Pharma" className="h-[3rem] w-auto object-contain" height="430" src="/brand/tr1-wordmark.webp" width="735" />
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold text-[var(--tr1-muted)] lg:flex">
            <Link className="transition hover:text-[var(--tr1-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]" href="/#plateforme">La plateforme</Link>
            <Link className="transition hover:text-[var(--tr1-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]" href="/#animations-formations">Animations & formations</Link>
            <Link className="transition hover:text-[var(--tr1-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]" href="/#pourquoi-tr1">Pourquoi TR1</Link>
          </nav>

          <details className="relative ml-auto lg:hidden">
            <summary className="cursor-pointer list-none rounded-md border border-[var(--tr1-line-strong)] bg-white/35 px-3 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]">Menu</summary>
            <nav className="absolute right-0 top-[calc(100%+.5rem)] z-50 grid w-56 gap-1 rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-2 text-sm font-semibold shadow-[0_18px_48px_rgba(14,29,49,.14)]">
              <Link className="rounded-lg px-3 py-2.5 hover:bg-white/70" href="/#plateforme">La plateforme</Link>
              <Link className="rounded-lg px-3 py-2.5 hover:bg-white/70" href="/#animations-formations">Animations & formations</Link>
              <Link className="rounded-lg px-3 py-2.5 hover:bg-white/70" href="/#pourquoi-tr1">Pourquoi TR1</Link>
              <Link className="rounded-lg px-3 py-2.5 text-[var(--tr1-muted)] hover:bg-white/70" href="/connexion">Connexion</Link>
            </nav>
          </details>

          <MarketingTrackedLink
            className="inline-flex shrink-0 rounded-md bg-[var(--tr1-orange)] px-3.5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 motion-reduce:transition-none sm:px-4"
            event="primary_cta_click"
            href="/#diagnostic"
            properties={{ placement: "header" }}
          >
            Demander une démo
          </MarketingTrackedLink>

          <Link className="hidden rounded-md px-2 py-2.5 text-sm font-semibold text-[var(--tr1-muted)] transition hover:text-[var(--tr1-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] lg:inline-flex" href="/connexion">Connexion</Link>
        </div>
      </header>

      {children}

      <footer className="border-t border-[var(--tr1-line)] bg-[var(--tr1-ivory)] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <img alt="TR1 Pharma" className="h-14 w-auto object-contain" height="430" src="/brand/tr1-wordmark.webp" width="735" />
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--tr1-muted)]">Pilotage commercial et coordination des actions terrain en pharmacie.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--tr1-muted)]">
            <Link className="hover:text-[var(--tr1-navy)]" href="/connexion">Connexion</Link>
            <Link className="hover:text-[var(--tr1-navy)]" href="/mentions-legales">Mentions légales</Link>
            <Link className="hover:text-[var(--tr1-navy)]" href="/politique-de-confidentialite">Politique de confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
