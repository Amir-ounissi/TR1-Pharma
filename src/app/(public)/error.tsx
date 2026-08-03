"use client";

import Link from "next/link";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-16 text-center">
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-[.18em] text-[#c9562d]">Service indisponible</p>
        <h1 className="mt-4 text-5xl font-black tracking-[-.06em]">TR1 ne peut pas afficher cette page pour le moment.</h1>
        <p className="mx-auto mt-5 max-w-xl leading-7 text-[#596574]">L’opération n’est pas confirmée. Vous pouvez réessayer ou revenir à l’accueil.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button className="rounded-md bg-[#0f2740] px-5 py-3 font-mono text-xs font-black uppercase text-white" onClick={reset}>Réessayer</button>
          <Link className="rounded-md border border-[#0f2740] px-5 py-3 font-mono text-xs font-black uppercase" href="/">Accueil</Link>
        </div>
      </div>
    </main>
  );
}
