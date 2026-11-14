import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Barcode, Building2, Check, ClipboardList, FileCheck2, LockKeyhole, PackageSearch, ShieldCheck } from "lucide-react";
import { Ean13Barcode, isValidEan13 } from "@/components/catalogue/ean13-barcode";
import { findPublicProduct, publicCatalogueProducts, publicProductFamily, publicProductImage, publicProductKey } from "@/lib/catalogue-products";

type ProductParams = { params: Promise<{ ref: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return publicCatalogueProducts.map((p) => ({ ref: publicProductKey(p) }));
}

export async function generateMetadata({ params }: ProductParams): Promise<Metadata> {
  const { ref } = await params;
  const product = findPublicProduct(ref);
  return {
    title: product ? product.name + " | " + product.brand + " | TR1 PHARMA" : "Fiche produit | TR1 PHARMA",
    description: product ? product.brand + " " + product.name + " — référence, conditionnement et code-barres EAN-13 pour pharmacies." : "Catalogue professionnel TR1 PHARMA.",
    robots: { index: false, follow: false },
  };
}

const detailClass = "grid gap-1 border-b border-[#e9edee] py-3 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-5";
const labelClass = "text-[11px] font-bold uppercase tracking-[.11em] text-[#81909b]";

function detail(label: string, value: string, warning = false) {
  return <div key={label} className={detailClass}>
    <dt className={labelClass}>{label}</dt>
    <dd className={"break-words text-sm font-semibold " + (warning ? "text-[#986642]" : "text-[#21384b]")}>{value}</dd>
  </div>;
}

export default async function PublicCatalogueProductPage({ params }: ProductParams) {
  const { ref } = await params;
  const product = findPublicProduct(ref);
  if (!product) notFound();
  const photo = publicProductImage(product);
  const eanIsValid = Boolean(product.ean && isValidEan13(product.ean));
  const cosmetics = product.brand !== "VK SWISS";
  const isBiodanceMask = product.brand === "Biodance" && product.category.toLowerCase().includes("hydrogel");

  return (
    <div className="space-y-7 pb-4">
      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6b7b87]">
        <Link href="/catalogue/decouvrir#produits" className="inline-flex min-h-9 items-center gap-2 hover:text-[#122a41]">
          <ArrowLeft size={16} aria-hidden="true" /> Catalogue
        </Link>
        <span>/</span><span>{product.brand}</span><span>/</span>
        <span className="max-w-[240px] truncate text-[#122a41]">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)]">
        <section className="space-y-3">
          <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-[#e6eaec] bg-[#f5f4f0] p-8 sm:min-h-[470px]">
            {photo ? (
              <Image src={photo.url} alt={product.brand + " " + product.name + ", présentation " + product.format}
                width={850} height={850} unoptimized priority className="max-h-[430px] w-full object-contain drop-shadow-[0_12px_18px_rgba(15,30,38,.08)]"/>
            ) : (
              <div className="text-center">
                <PackageSearch className="mx-auto text-[#b5bdc2]" size={48} strokeWidth={1.3} aria-hidden="true"/>
                <p className="mt-5 text-sm font-bold text-[#384f61]">Packshot en cours de validation</p>
                <p className="mt-2 max-w-[290px] text-xs leading-5 text-[#788895]">Nous n’affichons pas la photo d’un autre format ou produit pour remplir artificiellement la fiche.</p>
              </div>
            )}
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-2 text-[11px] font-bold text-[#546576]">Référencement fournisseur</span>
          </div>
          {photo && <p className="px-2 text-[11px] leading-5 text-[#82909a]">Visuel produit : {photo.source}. Image indicative ; autorisation de réutilisation à confirmer avant exploitation commerciale.</p>}
        </section>

        <div className="space-y-6">
          <header>
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#b56d3e]">{product.brand}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-.04em] text-[#122a41] sm:text-[41px]">{product.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#576879]">
              <span className="rounded-full border border-[#e2e6e7] bg-white px-3 py-2">{product.category}</span>
              <span className="rounded-full border border-[#e2e6e7] bg-white px-3 py-2">{product.format || "Format à confirmer"}</span>
              <span className="rounded-full border border-[#e2e6e7] bg-white px-3 py-2">{publicProductFamily(product)}</span>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#60717e]">
              Fiche d’identification destinée aux pharmacies et parapharmacies : dénomination, format, identifiant pour le logiciel d’officine et code-barres scannable.
            </p>
          </header>

          <section aria-labelledby="scannable-title" className="space-y-3">
            <div className="flex items-center gap-2">
              <Barcode size={19} className="text-[#b56d3e]" aria-hidden="true" />
              <h2 id="scannable-title" className="text-lg font-black text-[#122a41]">Code-barres pour le référencement</h2>
            </div>
            <Ean13Barcode ean={product.ean} />
          </section>

          <div className="rounded-2xl bg-[#142941] p-5 text-white sm:p-6">
            <div className="flex gap-3">
              <LockKeyhole size={19} className="mt-0.5 shrink-0 text-[#e6b18e]" aria-hidden="true"/>
              <div>
                <p className="text-sm font-black">Conditions de vente réservées aux officines</p>
                <p className="mt-2 text-xs leading-6 text-[#c1cdd8]">Les tarifs, paliers de commande et disponibilités sont communiqués uniquement après validation du compte professionnel.</p>
              </div>
            </div>
            <Link href="/catalogue/connexion" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#e99055] px-5 text-sm font-extrabold text-[#142941] hover:bg-[#f4a779]">
              Accès professionnel <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e5e9eb] bg-white p-5 sm:p-7">
          <div className="mb-3 flex items-center gap-2"><ClipboardList size={20} className="text-[#b56d3e]" aria-hidden="true" />
            <h2 className="text-lg font-black text-[#122a41]">Identification officinale</h2>
          </div>
          <dl>
            {detail("Dénomination", product.name)}
            {detail("Marque", product.brand)}
            {detail("Famille", publicProductFamily(product))}
            {detail("Catégorie", product.category)}
            {detail("EAN / GTIN-13", eanIsValid ? product.ean : "Non communiqué", !eanIsValid)}
            {detail("CIP / ACL", "Non communiqué par le fournisseur", true)}
            {product.sku ? detail("Référence fournisseur", product.sku) : null}
          </dl>
          <p className="mt-4 text-xs leading-6 text-[#758491]">Le contrôle EAN-13 vérifie la structure et la clé de contrôle. Il ne prouve pas à lui seul l’enregistrement du produit dans un LGO ou dans la Base Claude Bernard.</p>
        </section>

        <section className="rounded-2xl border border-[#e5e9eb] bg-white p-5 sm:p-7">
          <div className="mb-3 flex items-center gap-2"><Building2 size={20} className="text-[#b56d3e]" aria-hidden="true" />
            <h2 className="text-lg font-black text-[#122a41]">Présentation & référencement</h2>
          </div>
          <dl>
            {detail("Présentation", product.format || "À compléter", !product.format)}
            {detail("Type", cosmetics ? "Produit cosmétique" : "Complément alimentaire")}
            {detail("Conditionnement", isBiodanceMask ? "Prix fournisseur à l’unité ; commande par multiples de 4 masques (à confirmer)" : "À confirmer selon le colisage fournisseur", !isBiodanceMask)}
            {detail("Données INCI", cosmetics ? "Composition intégrale fabricant à fournir" : "Composition officielle à fournir", true)}
            {detail("Conseils d’utilisation", "Notice / étiquetage fabricant à intégrer", true)}
            {detail("Disponibilité", "À confirmer avec le distributeur", true)}
          </dl>
          <p className="mt-4 text-xs leading-6 text-[#758491]">Les informations de type LGO sont présentées comme une fiche de travail. Les données non confirmées ne sont ni inventées ni présentées comme issues de Claude Bernard.</p>
        </section>
      </div>

      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-[#e3e8e6] bg-[#f7f8f6] px-5 py-5">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#66816b]" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-black text-[#1e3748]">Statut : fiche en cours de validation</p>
          <p className="mt-1 text-xs leading-6 text-[#6f7f89]">
            EAN valide lorsque fourni, mais compatibilité LGO, colisage, visuel, données réglementaires et droit d’utilisation des photos à finaliser avant diffusion commerciale définitive.
          </p>
        </div>
        <Link href="/catalogue/decouvrir#produits" className="inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-[#253e51] underline-offset-4 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Retour aux produits
        </Link>
      </div>
    </div>
  );
}
