import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffdf8] text-[#0b1e32]">
      <header className="sticky top-0 z-40 border-b border-[#0b1e32]/8 bg-[#fffdf8]/94 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-5 px-5 lg:px-8">
          <Link className="flex shrink-0 items-center gap-3" href="/">
            <span className="relative grid size-10 place-items-center rounded-xl bg-[#0b1e32] font-mono text-[.65rem] font-black text-white after:absolute after:right-1.5 after:top-1.5 after:size-1.5 after:rounded-full after:bg-[#ef6a3a]">
              TR1
            </span>
            <span>
              <strong className="block text-sm font-black tracking-[-.02em]">TR1 Pharma</strong>
              <small className="block font-mono text-[.5rem] font-bold uppercase tracking-[.14em] text-[#667384]">
                Terrain intelligence
              </small>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold text-[#445265] lg:flex">
            <Link className="transition hover:text-[#c84f24]" href="/#produit">
              Produit
            </Link>
            <Link className="transition hover:text-[#c84f24]" href="/#animations">
              Animations
            </Link>
            <Link className="transition hover:text-[#c84f24]" href="/#pourquoi">
              Pourquoi TR1
            </Link>
          </nav>

          <Link
            className="ml-auto hidden rounded-lg bg-[#c84f24] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#a63f19] sm:inline-flex lg:ml-2"
            href="/#diagnostic"
          >
            Demander une démo
          </Link>

          <Link
            className="rounded-lg border border-[#0b1e32]/12 px-3.5 py-2.5 text-sm font-semibold transition hover:bg-[#0b1e32]/5 sm:px-4"
            href="/connexion"
          >
            Connexion
          </Link>
        </div>
      </header>

      {children}

      <footer className="border-t border-[#0b1e32]/10 bg-[#fffdf8] px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[#0b1e32] font-mono text-[.55rem] font-black text-white">
                TR1
              </span>
              <strong className="text-sm">TR1 Pharma</strong>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#667384]">
              Pilotage commercial et exécution terrain pour les marques qui se développent en pharmacie.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#667384]">
            <Link className="hover:text-[#0b1e32]" href="/connexion">
              Connexion
            </Link>
            <Link className="hover:text-[#0b1e32]" href="/mentions-legales">
              Mentions légales
            </Link>
            <Link className="hover:text-[#0b1e32]" href="/politique-de-confidentialite">
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
