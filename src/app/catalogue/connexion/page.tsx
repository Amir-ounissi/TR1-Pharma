import Link from "next/link";
import { connectPharmacyCatalogue } from "@/app/catalogue/actions";

export default async function CatalogueConnexion({
  searchParams,
}: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <div className="space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ea7015]">Espace pharmacie · privé</p>
        <h1 className="text-4xl font-black tracking-tight">Votre catalogue TR1.</h1>
        <p className="leading-7 text-[#69717d]">Connectez-vous avec le compte professionnel activé depuis votre invitation. L’inscription libre n’est pas disponible.</p>
      </div>
      <form action={connectPharmacyCatalogue} className="space-y-5 rounded-xl border border-[#0e1d31]/10 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-bold">Adresse email professionnelle</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3 outline-offset-2" />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-bold">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3 outline-offset-2" />
        </div>
        {erreur ? <p role="alert" className="rounded-md bg-[#fff1e5] p-3 text-sm text-[#803e0d]">{erreur === "acces" ? "Ce compte n’a pas d’accès actif au catalogue. Contactez TR1 PHARMA." : "Connexion impossible. Vérifiez vos identifiants."}</p> : null}
        <button type="submit" className="shop-primary-action w-full px-5 py-3">Accéder au catalogue</button>
      </form>
      <div className="space-y-2 text-sm text-[#69717d]">
        <p>Adresse préautorisée par TR1 PHARMA, mais pas encore de compte ? <Link className="font-extrabold text-[#0e1d31] underline" href="/catalogue/inscription">Activer mon espace</Link>.</p>
        <p>Vous n&apos;avez pas été invité ? Contactez votre interlocuteur TR1 PHARMA.</p>
      </div>
    </div>
  );
}
