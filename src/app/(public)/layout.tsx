import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen overflow-x-hidden bg-[#f5efe4] text-[#0f2740]">
    <header className="sticky top-0 z-40 border-b border-[#d8d0c2] bg-[#f5efe4]/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center px-5 lg:px-8"><Link className="flex items-center gap-3 font-mono text-sm font-black uppercase tracking-[.08em]" href="/"><span className="grid size-9 place-items-center rounded-md bg-[#0f2740] text-[.65rem] text-white">TR1</span>TR1 Pharma</Link><nav className="ml-auto flex items-center gap-5 text-sm"><Link className="hidden hover:text-[#c9562d] sm:block" href="/#produit">Produit</Link><Link className="rounded-md border border-[#0f2740] px-3 py-2 font-mono text-[.68rem] font-bold uppercase" href="/connexion">Connexion</Link></nav></div></header>
    {children}
    <footer className="border-t border-[#d8d0c2] px-5 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs text-[#66717d] sm:flex-row"><p>© 2026 TR1 Pharma — Pilotage commercial et exécution terrain.</p><div className="flex gap-4"><Link href="/mentions-legales">Mentions légales</Link><Link href="/politique-de-confidentialite">Confidentialité</Link></div></div></footer>
  </div>;
}
