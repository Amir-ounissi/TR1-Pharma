import { publicCatalogueProducts, publicProductImage, publicProductImages, publicProductKey } from "@/lib/catalogue-products";
import type { CatalogProduct } from "@/lib/private-catalogue";

// Les images validées pour le catalogue public sont la référence visuelle commune.
// Le catalogue pharmacie doit retrouver ces images même lorsque son champ image_url est vide.
const normalise = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();

const publicByEan = new Map(publicCatalogueProducts
  .filter((product) => product.ean)
  .map((product) => [product.ean, product] as const));

const publicByName = new Map(publicCatalogueProducts
  .map((product) => [`${normalise(product.brand)}:${normalise(product.name)}`, product] as const));

export type PharmacyProductWithVisuals = CatalogProduct & {
  brand_slug: string;
  brand_name: string;
  category: string;
  product_detail_href: string | null;
};

export function withPharmacyProductVisuals(
  product: CatalogProduct,
  brand: { name: string; slug: string },
): PharmacyProductWithVisuals {
  const original = (product.ean ? publicByEan.get(product.ean) : undefined)
    ?? publicByName.get(`${normalise(brand.name)}:${normalise(product.name)}`);
  const originalPhoto = original
    ? publicProductImage(original)?.url ?? publicProductImages(original)[0] ?? null
    : null;

  return {
    ...product,
    brand_slug: brand.slug,
    brand_name: brand.name,
    category: original?.category || "Autres soins",
    image_url: product.image_url?.trim() || originalPhoto,
    product_detail_href: original
      ? `/catalogue/marques/${brand.slug}/fiche/${publicProductKey(original)}`
      : null,
  };
}
