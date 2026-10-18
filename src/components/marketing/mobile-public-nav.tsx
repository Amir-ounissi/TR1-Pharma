"use client";

import { useRef } from "react";
import Link from "next/link";

/** Native disclosure menu with keyboard support and reliable same-page closing. */
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
      <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-md border border-white/25 px-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b9edcf]">Menu</summary>
      <nav aria-label="Navigation mobile" className="absolute right-0 top-[calc(100%+.75rem)] z-50 grid w-[min(78vw,290px)] gap-1 rounded-xl border border-white/10 bg-[#14293a] p-2 text-sm text-[#e7f2f4] shadow-2xl">
        <Link className="rounded-md px-4 py-3 transition hover:bg-white/10" href="/#marques">Notre approche</Link>
        <Link className="rounded-md px-4 py-3 transition hover:bg-white/10" href="/#terrain">Notre expertise</Link>
        <Link className="rounded-md px-4 py-3 transition hover:bg-white/10" href="/#pharmacies">Pharmacies</Link>
        <Link className="rounded-md px-4 py-3 transition hover:bg-white/10" href="/connexion">Connexion</Link>
      </nav>
    </details>
  );
}
