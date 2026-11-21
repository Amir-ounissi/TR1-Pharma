import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Barcode, Building2, Check, ClipboardList, LockKeyhole } from "lucide-react";
import { Ean13Barcode } from "@/components/catalogue/ean13-barcode";
import { ProductImageGallery } from "@/components/catalogue/product-image-gallery";
import { ExternalCompositionAnalysis } from "@/components/catalogue/external-composition-analysis";
import { isValidEan13 } from "@/lib/ean13";
import { publicProductInformation } from "@/lib/catalogue-public-information";
import { findPublicProduct, publicCatalogueProducts, publicProductFamily, publicProductImages, publicProductKey } from "@/lib/catalogue-products";

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
  const verifiedInfo = publicProductInformation(product);
  const productImages = publicProductImages(product);
  const eanIsValid = Boolean(product.ean && isValidEan13(product.ean));
  const cosmetics = product.brand !== "VK SWISS" && product.brand !== "Vitalora";
  const vitaloraReviewNotes: Record<string, string> = {
    "3770034273042": "Précautions d'emploi et recommandation d'âge de l'ashwagandha à confirmer auprès du laboratoire ; se référer à l'étiquetage final validé.",
    "3770034273189": "La formule contient de la berbérine : précautions, interactions médicamenteuses et public cible à confirmer auprès du laboratoire avant commercialisation.",
    "3770034273158": "Documents de traçabilité et analyses de contaminants du Shilajit à confirmer auprès du laboratoire avant commercialisation.",
  };
  const vitaloraReviewNote = product.brand === "Vitalora" ? vitaloraReviewNotes[product.ean] : undefined;

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
          <ProductImageGallery images={productImages} brand={product.brand} productName={product.name} format={product.format} />
        </section>

        <div className="space-y-6">
          <header>
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#b56d3e]">{product.brand}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-.04em] text-[#122a41] sm:text-[41px]">{product.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#576879]">
              <span className="rounded-full border border-[#e2e6e7] bg-white px-3 py-2">{product.category}</span>
              {product.format ? <span className="rounded-full border border-[#e2e6e7] bg-white px-3 py-2">{product.format}</span> : null}
              <span className="rounded-full border border-[#e2e6e7] bg-white px-3 py-2">{publicProductFamily(product)}</span>
            </div>
          </header>

          {verifiedInfo ? (
            <section aria-label="L’essentiel du produit" className="space-y-4">
              <p className="text-base leading-7 text-[#526676]">{verifiedInfo.description}</p>
              {verifiedInfo.skinTypes?.length ? <p className="text-sm font-semibold text-[#375443]">Pour : {verifiedInfo.skinTypes.join(" · ")}</p> : null}
              <ul className="space-y-2">{verifiedInfo.benefits.slice(0, 3).map(benefit => <li key={benefit} className="flex gap-2 text-sm leading-6 text-[#21384b]"><Check size={17} className="mt-1 shrink-0 text-[#698275]" aria-hidden="true" />{benefit}</li>)}</ul>
            </section>
          ) : null}

          <div className="rounded-2xl bg-[#142941] p-5 text-white sm:p-6">
            <div className="flex gap-3">
              <LockKeyhole size={19} className="mt-0.5 shrink-0 text-[#e6b18e]" aria-hidden="true"/>
              <div>
                <p className="text-sm font-black">Cette référence pour votre officine</p>
                <p className="mt-2 text-xs leading-6 text-[#c1cdd8]">Demandez vos tarifs et conditions par volume. TR1 PHARMA vérifie votre officine avant de vous adresser une invitation.</p>
                {product.brand === "Vitalora" ? <p className="mt-2 text-xs font-semibold leading-6 text-[#f5d4b9]">Présentation indicative de la gamme Vitalora. Référencement en préparation : aucune commande n’est ouverte pour ces références.</p> : null}
              </div>
            </div>
            <Link href={"/catalogue/demander-acces?interet=" + encodeURIComponent(product.brand + " — " + product.name)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#e99055] px-5 text-sm font-extrabold text-[#142941] hover:bg-[#f4a779]">
              {product.brand === "Vitalora" ? "Manifester mon intérêt" : "Demander mes tarifs professionnels"}
            </Link>
            <Link href="/catalogue/connexion" className="mt-3 block w-fit py-2 text-sm font-semibold text-white underline underline-offset-4">Déjà client ? Me connecter</Link>
          </div>
          {eanIsValid ? <details className="rounded-xl border border-[#e1e7e8] bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#526272]"><Barcode size={17} className="mr-2 inline" aria-hidden="true" />EAN {product.ean} · Afficher / copier le code-barres</summary>
            <div className="mt-3 max-w-sm"><Ean13Barcode ean={product.ean} /></div>
          </details> : null}
        </div>
      </div>

      {vitaloraReviewNote ? (
        <section aria-label="Précautions de référencement" className="rounded-2xl border border-[#ead9c8] bg-[#fff9f3] px-5 py-4">
          <h2 className="text-sm font-extrabold text-[#775039]">Référence en cours de validation</h2>
          <p className="mt-2 text-sm leading-6 text-[#775039]">{vitaloraReviewNote}</p>
        </section>
      ) : null}

      {verifiedInfo && (
        <section aria-labelledby="more-product-information" className="rounded-2xl border border-[#e5e9eb] bg-white p-5 sm:p-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#b56d3e]">Informations produit</p>
            <h2 id="more-product-information" className="mt-2 text-xl font-black text-[#122a41] sm:text-2xl">Tout savoir sur le produit</h2>
          </div>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-[#526676]">{verifiedInfo.description}</p>

          <div className="mt-6 grid gap-7 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#20394c]">Bénéfices et propriétés</h3>
              <ul className="mt-3 space-y-2">
                {verifiedInfo.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2 text-sm leading-6 text-[#5f7180]">
                    <Check size={15} className="mt-1 shrink-0 text-[#698275]" aria-hidden="true" /> {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#20394c]">Actifs clés</h3>
              <ul className="mt-3 space-y-2">
                {verifiedInfo.keyIngredients.map((ingredient) => (
                  <li key={ingredient} className="flex gap-2 text-sm leading-6 text-[#5f7180]">
                    <Check size={15} className="mt-1 shrink-0 text-[#698275]" aria-hidden="true" /> {ingredient}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {verifiedInfo.skinTypes && verifiedInfo.skinTypes.length > 0 && (
            <div className="mt-7">
              <h3 className="text-sm font-extrabold text-[#20394c]">Types de peau</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {verifiedInfo.skinTypes.map((skinType) => (
                  <span key={skinType} className="rounded-full border border-[#e4e8e8] bg-[#f7f8f6] px-3 py-2 text-xs font-semibold text-[#526473]">{skinType}</span>
                ))}
              </div>
            </div>
          )}

          {(verifiedInfo.usageSteps?.length || verifiedInfo.usage) && (
            <div className="mt-7 rounded-xl border border-[#e8ede8] bg-[#f7faf7] px-4 py-4">
              <h3 className="text-sm font-extrabold text-[#20394c]">Conseils d’utilisation</h3>
              {verifiedInfo.usageSteps && verifiedInfo.usageSteps.length > 0 ? (
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#5f7180]">
                  {verifiedInfo.usageSteps.map((step) => <li key={step} className="pl-1">{step}</li>)}
                </ol>
              ) : (
                <p className="mt-2 text-sm leading-6 text-[#5f7180]">{verifiedInfo.usage}</p>
              )}
            </div>
          )}

          {verifiedInfo.precautions && verifiedInfo.precautions.length > 0 && (
            <div className="mt-6 rounded-xl border border-[#f0e6dc] bg-[#fcf8f4] px-4 py-4">
              <h3 className="text-sm font-extrabold text-[#20394c]">Précautions d’emploi</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#5f7180]">
                {verifiedInfo.precautions.map((precaution) => <li key={precaution}>{precaution}</li>)}
              </ul>
            </div>
          )}

          {verifiedInfo.inci && (
            <details className="mt-6 rounded-xl border border-[#e5e9eb] bg-white px-4 py-4">
              <summary className="cursor-pointer text-sm font-extrabold text-[#20394c]">Composition INCI complète</summary>
              <p className="mt-3 break-words text-xs leading-6 text-[#5f7180]">{verifiedInfo.inci}</p>
            </details>
          )}
        </section>
      )}
      {cosmetics && eanIsValid && product.ean ? (
        <ExternalCompositionAnalysis ean={product.ean} />
      ) : null}


      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e5e9eb] bg-white p-5 sm:p-7">
          <div className="mb-3 flex items-center gap-2"><ClipboardList size={20} className="text-[#b56d3e]" aria-hidden="true" />
            <h2 className="text-lg font-black text-[#122a41]">Identification officinale</h2>
          </div>
          <dl>
            {detail("Dénomination", product.name)}
            {detail("Marque", product.brand)}
            {detail("Catégorie", product.category)}
            {eanIsValid ? detail("EAN / GTIN-13", product.ean) : null}
            {product.sku ? detail("Référence", product.sku) : null}
          </dl>
        </section>

        <section className="rounded-2xl border border-[#e5e9eb] bg-white p-5 sm:p-7">
          <div className="mb-3 flex items-center gap-2"><Building2 size={20} className="text-[#b56d3e]" aria-hidden="true" />
            <h2 className="text-lg font-black text-[#122a41]">Présentation & référencement</h2>
          </div>
          <dl>
            {product.format ? detail("Format", product.format) : null}
            {verifiedInfo?.packaging ? detail("Conditionnement", verifiedInfo.packaging) : null}
            {verifiedInfo?.origin ? detail("Pays de fabrication", verifiedInfo.origin) : null}
            {verifiedInfo?.alternateName ? detail("Autre dénomination", verifiedInfo.alternateName) : null}
            {detail("Type", cosmetics ? "Produit cosmétique" : "Complément alimentaire")}
          </dl>
        </section>
      </div>

    </div>
  );
}
