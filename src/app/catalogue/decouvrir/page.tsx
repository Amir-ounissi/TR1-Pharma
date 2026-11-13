import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, ClipboardList, LockKeyhole, ShoppingBasket, Truck } from "lucide-react";
import { PublicProductGrid } from "@/components/catalogue/public-product-grid";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";

export const metadata: Metadata = {
  title: "Catalogue grossiste pour pharmacies | TR1 PHARMA",
  description: "Découvrez les références de nos laboratoires partenaires. Accédez aux prix professionnels, conditions par volumes et demandes de commande sur votre espace pharmacie.",
  robots: { index: false, follow: false },
};

export default function PharmacieStorefront() {
  return (
    <div className="space-y-10 pb-4">
      <div className="-mx-5 -mt-8 border-b border-[#e2e7ec] bg-[#f4f0e7] px-5 py-3 sm:-mx-8 sm:-mt-12 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center text-[11px] font-semibold text-[#515d6b] sm:text-xs">
          <span className="inline-flex items-center gap-1.5"><BadgeCheck size={15} aria-hidden="true" /> Catalogue réservé aux professionnels de santé</span>
          <span className="inline-flex items-center gap-1.5"><Truck size={15} aria-hidden="true" /> Conditions selon le laboratoire et les volumes</span>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-lg bg-[#0e1d31] px-6 py-8 text-white sm:px-10 sm:py-10 lg:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-15 -top-25 size-100 rounded-full border-[45px] border-white/5" />
        <div className="relative max-w-[660px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[.24em] text-[#ffa460]">
            Catalogue B2B · Pharmacies & parapharmacies
          </p>
          <h1 className="mt-4 text-[32px] font-black leading-[1.08] tracking-[-.045em] sm:text-5xl lg:text-[56px]">
            Vos prochains réassorts commencent ici.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#d5dde7] sm:text-base">
            Retrouvez les références de nos laboratoires partenaires.
            Consultez les conditions réservées à votre officine et préparez vos demandes en quelques clics.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="#produits" className="shop-primary-action inline-flex min-h-12 items-center gap-2 px-5 text-sm">
              Voir les produits <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/catalogue/connexion" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/35 px-5 text-sm font-bold text-white transition hover:bg-white/10">
              <LockKeyhole size={16} aria-hidden="true" /> Mes prix professionnels
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-3 hidden w-60 rotate-[-8deg] rounded-md border border-white/15 bg-white/[.05] p-6 lg:block" aria-hidden="true">
          <Tr1BrandLogo className="h-25 w-full" primaryColor="#fffdf8" accentColor="#ea7015" />
          <div className="mt-4 border-t border-white/20 pt-3 text-center text-[10px] font-bold tracking-[.19em] text-white/75">CATALOGUE PROFESSIONNEL</div>
        </div>
      </section>

      <nav aria-label="Catégories du catalogue" className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold sm:text-sm">
        <a href="#produits" className="whitespace-nowrap rounded-md bg-[#0e1d31] px-5 py-2.5 text-white">Tous les produits</a>
        <a href="#produits" className="whitespace-nowrap rounded-md border border-[#e2e7ec] bg-white px-5 py-2.5 text-[#162a45] transition hover:bg-[#fff1e6]">VK SWISS</a>
        <Link href="/catalogue/connexion" className="whitespace-nowrap rounded-md border border-[#e2e7ec] bg-white px-5 py-2.5 text-[#162a45] transition hover:bg-[#fff1e6]">Conditions professionnelles</Link>
        <Link href="/catalogue/mes-demandes" className="whitespace-nowrap rounded-md border border-[#e2e7ec] bg-white px-5 py-2.5 text-[#162a45] transition hover:bg-[#fff1e6]">Mes demandes</Link>
      </nav>

      <PublicProductGrid />

      <section aria-labelledby="customer-benefits" className="grid gap-4 rounded-lg bg-white p-6 shadow-sm sm:grid-cols-3 sm:p-7">
        <h2 id="customer-benefits" className="sr-only">Services pour votre pharmacie</h2>
        {[
          { Icon: Building2, title: "Sélection pour votre officine", description: "Retrouvez les marques et références accessibles à votre pharmacie." },
          { Icon: ShoppingBasket, title: "Commande par quantités", description: "Composez votre panier et consultez vos paliers avant de transmettre une demande." },
          { Icon: ClipboardList, title: "Suivi des demandes", description: "Retrouvez l’historique de vos demandes de prix et de réassort dans votre espace." },
        ].map(({ Icon, title, description }) => (
          <div key={title} className="flex gap-3 py-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#fff1e6] text-[#162a45]"><Icon size={19} aria-hidden="true" /></div>
            <div><h3 className="text-sm font-extrabold text-[#0e1d31]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#69717d]">{description}</p></div>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-[#f4f0e7] px-6 py-8 sm:px-9">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#515d6b]">Votre espace pharmacie</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#0e1d31]">Connectez-vous pour consulter vos tarifs.</h2>
          <p className="mt-2 text-sm text-[#515d6b]">Votre accès est lié aux marques et aux conditions accordées à votre officine.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalogue/connexion" className="shop-secondary-action inline-flex min-h-11 items-center gap-2 px-5 text-sm">
            Connexion pro <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/catalogue/inscription" className="inline-flex min-h-11 items-center rounded-lg border border-[#dce3ea] px-5 text-sm font-bold text-[#0e1d31]">
            Activer mon invitation
          </Link>
        </div>
      </section>

      <p className="text-center text-[11px] text-[#69717d]">
        Présentation des références à titre informatif. Photos illustratives, non contractuelles. Les produits, prix et conditions effectives sont confirmés dans votre espace professionnel.
      </p>
    </div>
  );
}
