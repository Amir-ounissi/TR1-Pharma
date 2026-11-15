import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CatalogueAccessRequestForm } from "@/components/catalogue/catalogue-access-request-form";

export const metadata: Metadata = {
  title: "Demander un accès pharmacie | Catalogue TR1 PHARMA",
  description: "Demandez l’accès au catalogue professionnel TR1 PHARMA. Réservé aux pharmacies d’officine.",
  robots: { index: false, follow: false },
};

export default async function CatalogueAccessRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const { confirmation } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link href="/catalogue/decouvrir" className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-[#515d6b] hover:text-[#ad4b08]">
        <ArrowLeft size={16} aria-hidden="true" /> Retour au catalogue
      </Link>

      <section className="rounded-lg bg-[#0e1d31] px-6 py-8 text-white sm:px-9 sm:py-10">
        <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#ffa460]">Espace réservé aux officines</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Demander l’accès au catalogue.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d5dde7]">
          Renseignez les coordonnées de votre pharmacie et un identifiant officiel.
          Chaque demande est vérifiée par TR1 PHARMA avant l’envoi d’une invitation.
        </p>
        <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#f5c59f]">
          <ShieldCheck size={16} aria-hidden="true" /> Aucun accès ni compte n’est créé automatiquement.
        </p>
      </section>

      {confirmation === "1" ? (
        <section role="status" className="rounded-lg border border-[#b9d7c0] bg-[#f0f8f1] p-6 text-[#244b2d]">
          <h2 className="text-xl font-black">Votre demande a bien été enregistrée.</h2>
          <p className="mt-3 text-sm leading-7">
            TR1 PHARMA va vérifier les informations de votre officine. Si la demande est validée,
            vous recevrez une invitation à l’adresse e-mail professionnelle indiquée.
          </p>
          <p className="mt-3 text-sm font-semibold">Cette confirmation ne constitue pas encore une ouverture d’accès au catalogue.</p>
          <Link href="/catalogue/decouvrir" className="mt-5 inline-flex min-h-10 items-center font-bold underline underline-offset-4">
            Revenir au catalogue
          </Link>
        </section>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-[#0e1d31]">Informations de vérification</h2>
            <p className="text-sm leading-6 text-[#69717d]">Les champs marqués d’un astérisque sont obligatoires. Un SIRET valide ou un numéro FINESS est requis.</p>
          </div>
          <CatalogueAccessRequestForm />
        </>
      )}
    </div>
  );
}
