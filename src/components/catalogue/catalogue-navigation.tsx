"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileSpreadsheet, LayoutDashboard, LockKeyhole, Settings2, ShoppingBag, Store } from "lucide-react";

export function CatalogueNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/catalogue/administration")) {
    const entries = [
      { href: "/catalogue/administration", title: "Mon activité", icon: LayoutDashboard, active: pathname === "/catalogue/administration" },
      { href: "/catalogue/administration/commandes", title: "Commandes", icon: ClipboardList, active: pathname.startsWith("/catalogue/administration/commandes") },
      { href: "/catalogue/decouvrir", title: "Produits", icon: Store, active: false },
      { href: "/catalogue/administration/configuration", title: "Réglages", icon: Settings2, active: pathname.startsWith("/catalogue/administration/configuration") },
    ];
    return (
      <nav aria-label="Navigation TR1 PHARMA" className="flex flex-wrap items-center gap-1 text-xs font-bold sm:gap-2">
        {entries.map((item)=>(
          <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}
            className={"inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-2 transition sm:px-3 "+
              (item.active ? "bg-[#eaf0f3] text-[#142941]" : "text-[#506170] hover:bg-[#f3f5f5]")}>
            <item.icon size={15} aria-hidden="true" />
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
    );
  }
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
  const publicLinks = <>
    <Link href="/catalogue/decouvrir" className="px-2 py-2.5 hover:text-[#ad4b08]">Catalogue</Link>
    <Link href="/catalogue/decouvrir#marques" className="px-2 py-2.5 hover:text-[#ad4b08]">Les marques</Link>
    <Link href="/catalogue/demander-acces" className="rounded-lg bg-[#ea7015] px-4 py-2.5 text-[#0e1d31] hover:bg-[#f28331]">Demander un accès</Link>
    <Link href="/catalogue/connexion" className="inline-flex items-center gap-1.5 px-2 py-2.5 font-medium text-[#596a79] hover:text-[#ad4b08]"><LockKeyhole size={15} aria-hidden="true" /> Connexion pro</Link>
  </>;
  return (
    <nav aria-label="Navigation du catalogue" className="text-sm font-bold">
      <div className="hidden flex-wrap items-center gap-2 sm:flex sm:gap-4">{publicLinks}</div>
      <details key={pathname} className="relative sm:hidden">
        <summary className="cursor-pointer rounded-lg border border-[#dce3ea] px-4 py-3">Menu</summary>
        <div className="absolute right-0 top-full z-30 mt-2 grid w-60 gap-1 rounded-xl border border-[#dce3ea] bg-white p-3 shadow-lg">{publicLinks}</div>
      </details>
    </nav>
  );
}
