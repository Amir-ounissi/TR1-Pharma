import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lien catalogue indisponible | TR1 PHARMA",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrivateCatalogueAccessInvalid() {
  return (
    <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[#e2e7ec] bg-white p-7 text-center sm:p-10">
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ad4b08]">Accès professionnel TR1 PHARMA</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0e1d31]">Ce lien n’est plus disponible.</h1>
      <p className="text-sm leading-6 text-[#69717d]">
        Il a peut-être expiré ou été désactivé. Demandez à votre interlocuteur TR1 PHARMA de vous transmettre un nouveau lien privé.
      </p>
      <Link href="/catalogue/decouvrir" className="shop-primary-action inline-flex min-h-11 items-center justify-center px-5 text-sm">
        Découvrir le catalogue
      </Link>
    </div>
  );
}
