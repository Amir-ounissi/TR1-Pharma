import Link from "next/link";
export default function ConnexionPage() {
  return <main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-16">
    <p className="text-xs font-extrabold uppercase tracking-widest text-[#ad4b08]">TR1 PHARMA V2</p>
    <h1 className="mt-3 text-4xl font-bold text-[#0e1d31]">Accéder à votre espace</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <Link href="/connexion/tr1" className="rounded-xl border bg-white p-6 hover:border-[#ea7015]">
        <h2 className="text-xl font-bold">Cockpit commercial</h2>
        <p className="mt-2 text-sm text-[#69717d]">Gestion interne TR1 · Accès propriétaire.</p>
      </Link>
      <Link href="/catalogue/connexion" className="rounded-xl border bg-white p-6 hover:border-[#ea7015]">
        <h2 className="text-xl font-bold">Catalogue pharmacie</h2>
        <p className="mt-2 text-sm text-[#69717d]">Produits et demandes réservés aux pharmacies autorisées.</p>
      </Link>
    </div>
  </main>;
}
