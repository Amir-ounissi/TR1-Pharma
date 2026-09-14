import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffdf8] text-[#0b1e32]">
      <header className="sticky top-0 z-40 border-b border-[#0b1e32]/10 bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.6rem] max-w-7xl items-center gap-6 px-5 lg:px-8">
          <Link aria-label="TR1 Pharma — Accueil" className="flex shrink-0 items-center" href="/">
            <img
              alt="TR1 Pharma"
              className="h-[2.8rem] w-auto object-contain mix-blend-multiply sm:h-[3rem]"
              height="430"
              src="/brand/tr1-wordmark.webp"
              width="735"
            />
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-[#445265] lg:flex">
            <Link className="hover:text-[#c84f24]" href="/#pourquoi-tr1">Pourquoi TR1</Link>
            <Link className="hover:text-[#c84f24]" href="/#plateforme">La plateforme</Link>
            <Link className="hover:text-[#c84f24]" href="/#animations-formations">Animations & formations</Link>
          </nav>
          <Link className="ml-auto rounded-xl border border-[#0b1e32]/15 px-4 py-2.5 font-mono text-[.66rem] font-black uppercase tracking-[.05em] lg:ml-0" href="/connexion">Connexion</Link>
        </div>
      </header>
      <main className="min-h-[calc(100vh-4.6rem)] bg-[#fffdf8] [background-image:linear-gradient(rgba(11,30,50,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(11,30,50,.025)_1px,transparent_1px)] [background-size:30px_30px]">
        {children}
      </main>
    </div>
  );
}
