import Link from "next/link";
import { registerInvitedPharmacy } from "@/app/catalogue/actions";

export default async function CatalogueInscription({
  searchParams,
}: { searchParams: Promise<{ erreur?: string; confirmation?: string }> }) {
  const { erreur, confirmation } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <div className="space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ea7015]">
          Accès professionnel sur invitation
        </p>
        <h1 className="text-4xl font-black tracking-tight">Activez votre espace pharmacie.</h1>
        <p className="text-sm leading-7 text-[#69717d]">
          Utilisez uniquement l’adresse professionnelle invitée par TR1 PHARMA.
          L’accès aux marques est validé après confirmation de votre adresse email.
        </p>
      </div>

      {confirmation === "1" ? (
        <div role="status" className="rounded-xl border border-[#4f7a58]/30 bg-[#edf7ee] p-5 text-sm leading-6 text-[#315638]">
          Si cette adresse peut être enregistrée, vous recevrez les instructions de
          confirmation par email. Consultez également les courriers indésirables.
          Une fois l’adresse confirmée, connectez-vous au catalogue.
          <div className="mt-3"><Link className="font-extrabold underline" href="/catalogue/connexion">Se connecter</Link></div>
        </div>
      ) : (
        <form action={registerInvitedPharmacy} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-6">
          <div className="space-y-2">
            <label htmlFor="register_email" className="text-sm font-bold">Adresse email invitée</label>
            <input id="register_email" name="email" type="email" autoComplete="email" required
              className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3" />
          </div>
          <div className="space-y-2">
            <label htmlFor="register_password" className="text-sm font-bold">Mot de passe (10 caractères minimum)</label>
            <input id="register_password" name="password" type="password" minLength={10}
              maxLength={128} autoComplete="new-password" required
              className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3" />
          </div>
          <div className="space-y-2">
            <label htmlFor="register_confirm" className="text-sm font-bold">Confirmer le mot de passe</label>
            <input id="register_confirm" name="confirm" type="password" minLength={10}
              maxLength={128} autoComplete="new-password" required
              className="w-full rounded-md border border-[#0e1d31]/20 px-4 py-3" />
          </div>
          {erreur ? <p role="alert" className="text-sm font-semibold text-red-700">
            {erreur === "donnees"
              ? "Vérifiez votre adresse et vos deux mots de passe."
              : "Inscription momentanément indisponible. Contactez TR1 PHARMA."}
          </p> : null}
          <button type="submit" className="shop-primary-action w-full px-4 py-3">
            Recevoir mon accès
          </button>
        </form>
      )}
      <p className="text-sm text-[#69717d]">
        Déjà inscrit ? <Link href="/catalogue/connexion" className="font-bold underline">Se connecter</Link>.
      </p>
    </div>
  );
}
