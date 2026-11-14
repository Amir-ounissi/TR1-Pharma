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

// Visibilité publique des marques : les données produits restent conservées ci-dessous.
 // Passer une marque à false la masque du catalogue public sans supprimer ses références, EAN ou visuels.
export const catalogueBrandVisibility: Record<string, boolean> = {
  "VK SWISS": false,
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
  return p.brand === "VK SWISS" ? "Complément alimentaire" : "Cosmétique · soin de la peau";
}
