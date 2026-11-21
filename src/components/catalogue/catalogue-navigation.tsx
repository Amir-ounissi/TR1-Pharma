"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, LockKeyhole, ShoppingBag, Store } from "lucide-react";

export function CatalogueNavigation() {
  const pathname = usePathname();
  const publicPage = pathname.startsWith("/catalogue/decouvrir") || pathname === "/catalogue/demander-acces";
  if (!publicPage) return (
          <nav className="flex flex-wrap items-center gap-2 text-xs font-extrabold sm:gap-5 sm:text-sm" aria-label="Navigation du catalogue">
            <Link href="/catalogue/decouvrir" className="inline-flex items-center gap-1.5 p-2 hover:text-[#ad4b08]">
              <Store size={16} aria-hidden="true" /> <span className="hidden sm:inline">Découvrir</span><span className="sm:hidden">Boutique</span>
            </Link>
            <Link href="/catalogue" className="inline-flex items-center gap-1.5 p-2 hover:text-[#ad4b08]">
              <ShoppingBag size={16} aria-hidden="true" /> Mes produits
            </Link>
            <Link href="/catalogue/comparer" className="inline-flex items-center gap-1.5 p-2 hover:text-[#ad4b08]"><FileSpreadsheet size={16} aria-hidden="true" /> Comparer mes achats</Link>
            <Link href="/catalogue/mes-demandes" className="p-2 hover:text-[#ad4b08]">Mes demandes</Link>
            <Link href="/catalogue/connexion" className="inline-flex items-center gap-1.5 rounded-md border border-[#dce3ea] px-3 py-2.5 hover:bg-[#fff1e6]">
              <LockKeyhole size={15} aria-hidden="true" /> Connexion pro
            </Link>
          </nav>
  );
  return (
    <nav aria-label="Navigation du catalogue" className="flex flex-wrap items-center gap-2 text-sm font-bold sm:gap-4">
      <Link href="/catalogue/decouvrir" className="px-2 py-2.5 hover:text-[#ad4b08]">Catalogue</Link>
      <Link href="/catalogue/decouvrir#marques" className="px-2 py-2.5 hover:text-[#ad4b08]">Les marques</Link>
      <Link href="/catalogue/demander-acces" className="rounded-lg bg-[#ea7015] px-4 py-2.5 text-[#0e1d31] hover:bg-[#f28331]">Demander un accès</Link>
      <Link href="/catalogue/connexion" className="inline-flex items-center gap-1.5 px-2 py-2.5 font-medium text-[#596a79] hover:text-[#ad4b08]"><LockKeyhole size={15} aria-hidden="true" /> Connexion pro</Link>
    </nav>
  );
}
