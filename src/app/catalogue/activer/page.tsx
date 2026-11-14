import { activatePharmacyCatalogue } from "@/app/catalogue/actions";

export default async function CatalogueActivation({
  searchParams,
}: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ea7015]">Invitation TR1 PHARMA</p>
      <h1 className="text-4xl font-black tracking-tight">Activez votre accès.</h1>
      <p className="text-[#69717d]">Définissez votre mot de passe personnel pour consulter les marques sélectionnées pour votre officine.</p>
      <form action={activatePharmacyCatalogue} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-6">
        <label className="block text-sm font-bold" htmlFor="password">Mot de passe (10 caractères minimum)</label>
        <input className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3" id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
        <label className="block text-sm font-bold" htmlFor="confirm">Confirmer le mot de passe</label>
        <input className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3" id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required />
        {erreur ? <p role="alert" className="text-sm text-red-700">Activation impossible. Vérifiez les deux mots de passe ou contactez TR1 PHARMA.</p> : null}
        <button type="submit" className="w-full rounded-md bg-[#0e1d31] px-4 py-3 font-bold text-white">Activer mon compte</button>
      </form>
    </div>
  );
}
