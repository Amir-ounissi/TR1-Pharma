import { publicPreviewProducts, type PublicPreviewProduct } from "@/lib/catalogue-public-preview";
import { productPhotoByEan, productGalleryByEan, productGalleryByName, biodancePhotoByName } from "@/lib/catalogue-product-photos";
import { vkSwissMediaBySku } from "@/lib/catalogue-vk-swiss-media";

export type PublicCatalogueProduct = PublicPreviewProduct & { sku?: string };

const vkProducts: PublicCatalogueProduct[] = [
  { brand: "VK SWISS", name: "Ashwagandha KSM-66", sku: "6467333", ean: "7629999810969", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Bacopa", sku: "6467332", ean: "7629999601949", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Curcuma", sku: "6467334", ean: "7629999608559", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Shatavari", sku: "6467330", ean: "7629999637191", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Shilajit", sku: "6467328", ean: "7629999731837", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Tribulus", sku: "6467329", ean: "7629999149366", format: "30 gélules", category: "Compléments alimentaires" },
];

// Gamme vitrine Vitalora : 18 références, sans prix ni panier public.
// Certaines fiches présentent des précautions en attendant validation du laboratoire.
const vitaloraProducts: PublicCatalogueProduct[] = [
  { brand: "Vitalora", name: "Acide Hyaluronique & Collagène", sku: "VIT-3770034273097", ean: "3770034273097", format: "60 gélules", category: "Beauté de la peau" },
  { brand: "Vitalora", name: "Ashwagandha KSM-66® Biologique", sku: "VIT-3770034273042", ean: "3770034273042", format: "60 gélules", category: "Stress & équilibre" },
  { brand: "Vitalora", name: "Bacopa Safran", sku: "VIT-3770034273134", ean: "3770034273134", format: "60 gélules", category: "Concentration & humeur" },
  { brand: "Vitalora", name: "Coenzyme Q10", sku: "VIT-3770034273172", ean: "3770034273172", format: "", category: "Vitalité" },
  { brand: "Vitalora", name: "Collagène Beauté", sku: "VIT-3770034273226", ean: "3770034273226", format: "Poudre", category: "Beauté de la peau" },
  { brand: "Vitalora", name: "Confort Intestinal", sku: "VIT-3770034273219", ean: "3770034273219", format: "60 gélules", category: "Confort digestif" },
  { brand: "Vitalora", name: "Créatine Monohydrate Micronisée", sku: "VIT-3770034273196", ean: "3770034273196", format: "Poudre", category: "Sport & performance" },
  { brand: "Vitalora", name: "Curcuma Optimisé", sku: "VIT-3770034273073", ean: "3770034273073", format: "30 gélules", category: "Articulations" },
  { brand: "Vitalora", name: "Fer Bisglycinate", sku: "VIT-3770034273103", ean: "3770034273103", format: "60 gélules", category: "Minéraux" },
  { brand: "Vitalora", name: "Force Capillaire", sku: "VIT-3770034273202", ean: "3770034273202", format: "Gélules", category: "Cheveux & ongles" },
  { brand: "Vitalora", name: "Glycémie", sku: "VIT-3770034273189", ean: "3770034273189", format: "60 gélules", category: "Métabolisme" },
  { brand: "Vitalora", name: "Magnésium Bisglycinate", sku: "VIT-3770034273080", ean: "3770034273080", format: "Conditionnement à confirmer", category: "Minéraux" },
  { brand: "Vitalora", name: "Multivitamines — 17 Nutriments Bioactifs", sku: "VIT-3770034273127", ean: "3770034273127", format: "30 gélules", category: "Vitamines & minéraux" },
  { brand: "Vitalora", name: "Oméga 3 Premium Epax®", sku: "VIT-3770034273066", ean: "3770034273066", format: "60 capsules", category: "Oméga 3" },
  { brand: "Vitalora", name: "Spiruline Française Biologique", sku: "VIT-3770034273059", ean: "3770034273059", format: "120 comprimés", category: "Vitalité" },
  { brand: "Vitalora", name: "Shilajit", sku: "VIT-3770034273158", ean: "3770034273158", format: "60 gélules", category: "Vitalité" },
  { brand: "Vitalora", name: "Vitamine C Liposomale", sku: "VIT-3770034273165", ean: "3770034273165", format: "60 gélules", category: "Vitamines & minéraux" },
  { brand: "Vitalora", name: "Zinc Bisglycinate", sku: "VIT-3770034273110", ean: "3770034273110", format: "60 gélules", category: "Minéraux" },
];

// Photographies extraites du catalogue Vitalora septembre 2026 (packshots associés par EAN).
// Hébergement média externe : vérifier sa pérennité avant le lancement commercial.
const vitaloraPhotoByEan: Record<string, string> = {
  "3770034273042": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273042-ashwagandha-ksm66-bio.webp?v=1795244710",
  "3770034273059": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273059-spiruline-bio-francaise.webp?v=1795244725",
  "3770034273066": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273066-omega3-premium-epax.webp?v=1795244729",
  "3770034273073": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273073-curcuma-optimise.webp?v=1795244734",
  "3770034273080": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273080-magnesium-bisglycinate.webp?v=1795244738",
  "3770034273097": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273097-acide-hyaluronique-collagene.webp?v=1795244742",
  "3770034273103": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273103-fer-bisglycinate.webp?v=1795244747",
  "3770034273110": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273110-zinc-bisglycinate.webp?v=1795244755",
  "3770034273127": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273127-multivitamines-17.webp?v=1795244759",
  "3770034273134": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273134-bacopa-safran.webp?v=1795244764",
  "3770034273158": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273158-shilajit.webp?v=1795244768",
  "3770034273165": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273165-vitamine-c-liposomale.webp?v=1795244772",
  "3770034273172": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273172-coenzyme-q10.webp?v=1795244777",
  "3770034273189": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273189-glycemie.webp?v=1795244787",
  "3770034273196": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273196-creatine-monohydrate.webp?v=1795244792",
  "3770034273202": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273202-force-capillaire.webp?v=1795244797",
  "3770034273219": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273219-confort-intestinal.webp?v=1795244801",
  "3770034273226": "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-vitalora-3770034273226-collagene-beaute.webp?v=1795244805",
};

// Visibilité publique des marques : les données produits restent conservées ci-dessous.
 // Passer une marque à false la masque du catalogue public sans supprimer ses références, EAN ou visuels.
export const catalogueBrandVisibility: Record<string, boolean> = {
  "VK SWISS": false,
  "Vitalora": true,
};

// Deux références dont le conditionnement ou le packshot ne sont pas cohérents avec la source
// restent disponibles dans les données mais sont écartées de la galerie publique.
const pendingVisualAudit = new Set(["8809968132714"]);
export const publicCatalogueProducts: PublicCatalogueProduct[] = [
  ...publicPreviewProducts.filter((p) =>
    catalogueBrandVisibility[p.brand] !== false &&
    !pendingVisualAudit.has(p.ean) &&
    !(p.brand === "Biodance" && p.name === "Caviar PDRN Dual Gel Toner Pads")
  ),
  ...vkProducts.filter((p) => catalogueBrandVisibility[p.brand] !== false),
  ...vitaloraProducts.filter((p) => catalogueBrandVisibility[p.brand] !== false),
];

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function publicProductKey(p: PublicCatalogueProduct): string {
  return p.ean || [p.brand, p.name, p.format].map(slug).join("--");
}

export function publicProductHref(p: PublicCatalogueProduct): string {
  return "/catalogue/decouvrir/fiche/" + publicProductKey(p);
}

export function findPublicProduct(key: string): PublicCatalogueProduct | null {
  return publicCatalogueProducts.find((p) => publicProductKey(p) === key) ?? null;
}

export function publicProductImage(p: PublicCatalogueProduct): {url:string; source:string} | null {
  if (p.brand === "Vitalora" && p.ean && vitaloraPhotoByEan[p.ean]) {
    return { url: vitaloraPhotoByEan[p.ean], source: "Catalogue Vitalora septembre 2026" };
  }
  if (p.brand === "VK SWISS" && p.sku && vkSwissMediaBySku[p.sku]) {
    return { url: vkSwissMediaBySku[p.sku].url, source: "VK SWISS" };
  }
  if (p.brand === "Biodance" && !p.ean) return biodancePhotoByName[p.name] ?? null;
  return p.ean ? productPhotoByEan[p.ean] ?? null : null;
}

export function publicProductImages(p: PublicCatalogueProduct): string[] {
  const gallery = p.ean
    ? productGalleryByEan[p.ean] ?? []
    : p.brand === "Biodance" ? productGalleryByName[p.name] ?? [] : [];
  const primary = publicProductImage(p);
  return [...new Set([...(primary ? [primary.url] : []), ...gallery])];
}

export function publicProductFamily(p: PublicCatalogueProduct) {
  return p.brand === "VK SWISS" || p.brand === "Vitalora"
    ? "Complément alimentaire"
    : "Cosmétique · soin de la peau";
}
