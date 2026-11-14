import { publicPreviewProducts, type PublicPreviewProduct } from "@/lib/catalogue-public-preview";
import { productPhotoByEan } from "@/lib/catalogue-product-photos";
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

export const publicCatalogueProducts: PublicCatalogueProduct[] = [...publicPreviewProducts, ...vkProducts];

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
  return p.ean ? productPhotoByEan[p.ean] ?? null : null;
}

export function publicProductFamily(p: PublicCatalogueProduct) {
  return p.brand === "VK SWISS" ? "Complément alimentaire" : "Cosmétique · soin de la peau";
}
