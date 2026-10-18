"use client";

import { useRef } from "react";
import Link from "next/link";

/**
 * Keep the native details/summary keyboard behavior while closing the menu
 * after a same-page anchor is followed (including on small touch screens).
 */
export function MobilePublicNav() {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={menu}
      className="relative lg:hidden"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a") && menu.current) menu.current.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector<HTMLElement>("summary")?.focus();
          event.stopPropagation();
        }
      }}
    >
      <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-sm border border-[#182824]/20 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">
        Menu
      </summary>
      <nav aria-label="Navigation mobile" className="absolute right-0 top-[calc(100%+.75rem)] z-50 grid w-60 gap-1 rounded border border-[#182824]/15 bg-[#faf9f6] p-2 text-sm shadow-lg">
        <Link className="rounded px-3 py-3 hover:bg-white" href="/#marques">L’accompagnement</Link>
        <Link className="rounded px-3 py-3 hover:bg-white" href="/#terrain">À propos</Link>
        <Link className="rounded px-3 py-3 hover:bg-white" href="/#pharmacies">Pharmacies</Link>
        <Link className="rounded px-3 py-3 hover:bg-white" href="/connexion">Connexion</Link>
      </nav>
    </details>
  );
}
