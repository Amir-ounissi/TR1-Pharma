import { faireProductInformationByEan } from "@/lib/catalogue-faire-product-information";
import { officialBiodanceByName, officialBeautyOfJoseonByEan, officialDrAltheaByEan, additionalBeautyOfJoseonByEan, additionalDrAltheaByEan } from "@/lib/catalogue-official-product-information";
import type { PublicCatalogueProduct } from "@/lib/catalogue-products";

export function publicProductInformation(product: PublicCatalogueProduct) {
  const official = product.brand === "Biodance" ? officialBiodanceByName[product.name]
    : product.brand === "Beauty of Joseon" ? officialBeautyOfJoseonByEan[product.ean] ?? additionalBeautyOfJoseonByEan[product.ean]
    : product.brand === "Dr. Althea" ? officialDrAltheaByEan[product.ean] ?? additionalDrAltheaByEan[product.ean]
    : undefined;
  return official ?? faireProductInformationByEan[product.ean];
}
