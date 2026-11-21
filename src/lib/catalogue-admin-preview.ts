import {
  euroHT, firstOrderQuantity, orderablePricingTiers,
} from "@/lib/private-catalogue-format";
import type { CataloguePricing } from "@/lib/private-catalogue";
import type { IndicativeTier, ContractTier } from "@/lib/private-catalogue-format";

export type AdminPreviewIndicativeTier = { product_id: string; min_quantity: number; price_min_ht: number; price_max_ht: number };
export type AdminPreviewContractTier = { product_id: string; min_quantity: number; price_ht: number };
export type AdminPreviewFlatPrice = { product_id: string; price_ht: number };

/**
 * Match the pricing shown by catalogue_my_data: a customer only sees their
 * contractual tiers if their brand access is contractual. A flat legacy
 * price applies at the product minimum unless an explicit tier overrides it.
 * Internal product.price_ht is intentionally never accepted by this helper.
 */
export function resolveAdminPreviewPricing({
  productId, minimumQuantity, pricingMode, indicative, contractual, flat,
}: {
  productId: string;
  minimumQuantity: number;
  pricingMode: "contractual" | "indicative";
  indicative: readonly AdminPreviewIndicativeTier[];
  contractual: readonly AdminPreviewContractTier[];
  flat: readonly AdminPreviewFlatPrice[];
}): CataloguePricing {
  const indicativeTiers = indicative
    .filter(item=>item.product_id===productId)
    .map(({ min_quantity,price_min_ht,price_max_ht })=>({min_quantity,price_min_ht,price_max_ht}))
    .sort((a,b)=>a.min_quantity-b.min_quantity);
  if(pricingMode==="contractual"){
    const contractTiers = contractual.filter(item=>item.product_id===productId)
      .map(({min_quantity,price_ht})=>({min_quantity,price_ht}));
    const legacy = flat.find(item=>item.product_id===productId);
    if(legacy && !contractTiers.some(t=>t.min_quantity===minimumQuantity)){
      contractTiers.push({min_quantity:minimumQuantity,price_ht:Number(legacy.price_ht)});
    }
    if(contractTiers.length) {
      return {mode:"contractual",tiers:contractTiers.sort((a,b)=>a.min_quantity-b.min_quantity)};
    }
  }
  return {mode:"indicative",tiers:indicativeTiers};
}

export function adminPreviewFirstTierLabel(pricing: CataloguePricing, minQty: number, step: number) {
  const first = orderablePricingTiers<IndicativeTier | ContractTier>(pricing.tiers,minQty,step)[0];
  if(!first) return {amount:"Tarif sur demande",detail:"Prix et conditions à confirmer"};
  const quantity = firstOrderQuantity(first.threshold,step);
  const tier = first.tier;
  const amount = "price_ht" in tier
    ? euroHT(Number(tier.price_ht))+" HT / unité"
    : (euroHT(Number(tier.price_min_ht))===euroHT(Number(tier.price_max_ht))
      ? euroHT(Number(tier.price_min_ht))
      : euroHT(Number(tier.price_min_ht))+" – "+euroHT(Number(tier.price_max_ht)))+" HT / unité";
  return {
    amount,
    detail:(pricing.mode==="contractual"?"Prix contractuel":"Prix indicatif")+
      " · dès "+quantity+" unités",
  };
}
