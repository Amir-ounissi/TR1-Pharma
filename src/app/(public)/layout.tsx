import Image from "next/image";
import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--tr1-ivory)] text-[var(--tr1-navy)]">
      <header className="sticky top-0 z-40 border-b border-[var(--tr1-line)] bg-[var(--tr1-ivory)]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center gap-5 px-5 lg:px-8">
          <Link className="flex shrink-0 items-center" href="/" aria-label="TR1 Pharma — Accueil">
            <Image
              alt="TR1 Pharma"
              className="h-[3.15rem] w-auto object-contain"
              height={430}
              priority
              src="/brand/tr1-wordmark.webp"
              width={735}
            />
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold text-[var(--tr1-muted)] lg:flex">
            <Link className="transition hover:text-[var(--tr1-orange)]" href="/#produit">
              Produit
            </Link>
            <Link className="transition hover:text-[var(--tr1-orange)]" href="/#animations">
              Animations
            </Link>
            <Link className="transition hover:text-[var(--tr1-orange)]" href="/#pourquoi">
              Pourquoi TR1
            </Link>
          </nav>

          <Link
            className="ml-auto hidden rounded-md bg-[var(--tr1-orange)] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:brightness-95 sm:inline-flex lg:ml-2"
            href="/#diagnostic"
          >
            Demander une démo
          </Link>

          <Link
            className="rounded-md border border-[var(--tr1-line-strong)] bg-white/25 px-3.5 py-2.5 text-sm font-semibold transition hover:bg-white/55 sm:px-4"
            href="/connexion"
          >
            Connexion
          </Link>
        </div>
      </header>

      {children}

      <footer className="border-t border-[var(--tr1-line)] bg-[var(--tr1-ivory)] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              alt="TR1 Pharma"
              className="h-14 w-auto object-contain"
              height={430}
              src="/brand/tr1-wordmark.webp"
              width={735}
            />
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--tr1-muted)]">
              Exécution commerciale terrain pour les marques qui se développent en pharmacie.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--tr1-muted)]">
            <Link className="hover:text-[var(--tr1-navy)]" href="/connexion">
              Connexion
            </Link>
            <Link className="hover:text-[var(--tr1-navy)]" href="/mentions-legales">
              Mentions légales
            </Link>
            <Link className="hover:text-[var(--tr1-navy)]" href="/politique-de-confidentialite">
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
