"use client";

import { useRef } from "react";
import Link from "next/link";

/** Accessible native mobile navigation matching the established TR1 palette. */
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
      <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-[5px] border border-[var(--tr1-line-strong)] px-3 text-xs font-semibold text-[var(--tr1-navy)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tr1-orange)]">Menu</summary>
      <nav aria-label="Navigation mobile" className="absolute right-0 top-[calc(100%+.75rem)] z-50 grid w-[min(78vw,290px)] gap-1 rounded-md border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-2 text-sm text-[var(--tr1-navy)] shadow-xl">
        <Link className="rounded-sm px-4 py-3 transition hover:bg-[var(--tr1-ivory-deep)]" href="/#marques">Accompagnement marques</Link>
        <Link className="rounded-sm px-4 py-3 transition hover:bg-[var(--tr1-ivory-deep)]" href="/#terrain">Suivi terrain</Link>
        <Link className="rounded-sm px-4 py-3 transition hover:bg-[var(--tr1-ivory-deep)]" href="/#pharmacies">Pharmacies</Link>
        <Link className="rounded-sm px-4 py-3 transition hover:bg-[var(--tr1-ivory-deep)]" href="/connexion">Connexion</Link>
      </nav>
    </details>
  );
}
