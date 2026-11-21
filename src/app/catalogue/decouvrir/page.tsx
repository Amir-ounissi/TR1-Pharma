import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Layers, Handshake } from "lucide-react";
import { PublicProductGrid } from "@/components/catalogue/public-product-grid";
import { publicCatalogueProducts, publicProductKey } from "@/lib/catalogue-products";
import { publicProductInformation } from "@/lib/catalogue-public-information";

export const metadata: Metadata = {
  title: "Catalogue professionnel multimarque | TR1 PHARMA",
  description: "Découvrez les soins coréens et la micronutrition sélectionnés par TR1 PHARMA pour votre officine.",
  robots: { index: false, follow: false },
};

export default function PharmacieStorefront() {
  const benefits = Object.fromEntries(publicCatalogueProducts.map(product => [publicProductKey(product), publicProductInformation(product)?.benefits[0] ?? ""]));
  return (
    <div className="-mt-3 space-y-5 pb-4 sm:-mt-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e2e7ec] pb-5">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Des marques à découvrir pour votre officine.</h1>
          <p className="mt-2 text-base leading-6 text-[#526272]">Soins coréens et micronutrition : une sélection multimarque, avec un interlocuteur pour accompagner votre implantation.</p>
        </div>
        <Link href="/catalogue/demander-acces" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#ea7015] px-5 text-sm font-extrabold hover:bg-[#f28331]">Demander mes tarifs professionnels</Link>
      </header>
      <PublicProductGrid benefits={benefits} />
      <section aria-labelledby="customer-benefits" className="grid gap-6 rounded-2xl border border-[#e2e7ec] bg-white p-6 sm:grid-cols-3">
        <h2 id="customer-benefits" className="sr-only">TR1 PHARMA accompagne votre officine</h2>
        {[
          { Icon: Layers, title: "Une sélection multimarque", description: "Explorez les gammes et identifiez les références adaptées à votre officine." },
          { Icon: Building2, title: "Vos conditions professionnelles", description: "Demandez les tarifs et conditions applicables à votre pharmacie, selon les gammes et les volumes." },
          { Icon: Handshake, title: "Un interlocuteur terrain", description: "Échangez avec TR1 PHARMA sur votre sélection, votre implantation et l’accompagnement de votre équipe." },
        ].map(({ Icon, title, description }) => (
          <div key={title} className="flex gap-3">
            <Icon size={23} className="mt-1 shrink-0 text-[#ad4b08]" aria-hidden="true" />
            <div><h3 className="text-base font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#526272]">{description}</p></div>
          </div>
        ))}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#142941] p-6 text-white sm:p-8">
        <div><h2 className="text-2xl font-black">Une gamme vous intéresse ?</h2><p className="mt-2 max-w-xl text-base leading-6 text-[#d5dde7]">Présentez-nous votre officine. Après vérification, vous recevrez une invitation pour consulter vos conditions professionnelles.</p></div>
        <Link href="/catalogue/demander-acces" className="inline-flex min-h-11 items-center rounded-lg bg-[#ea7015] px-5 text-sm font-extrabold text-[#0e1d31] hover:bg-[#f28331]">Demander mes tarifs professionnels</Link>
      </section>
    </div>
  );
}
