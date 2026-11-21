import { describe,expect,it } from "vitest";
import { adminPreviewFirstTierLabel,resolveAdminPreviewPricing } from "@/lib/catalogue-admin-preview";

const indicative = [
  { product_id:"a",min_quantity:6,price_min_ht:10,price_max_ht:12 },
  { product_id:"a",min_quantity:12,price_min_ht:9,price_max_ht:11 },
  { product_id:"b",min_quantity:6,price_min_ht:99,price_max_ht:99 },
];

describe("admin-only pharmacy catalogue preview",()=>{
  it("never displays contract or internal prices in the general indicative preview",()=>{
    const pricing=resolveAdminPreviewPricing({
      productId:"a",minimumQuantity:6,pricingMode:"indicative",
      indicative,contractual:[{product_id:"a",min_quantity:6,price_ht:7.1}],
      flat:[{product_id:"a",price_ht:2.8}],
    });
    expect(pricing.mode).toBe("indicative");
    expect(pricing.tiers).toEqual([
      {min_quantity:6,price_min_ht:10,price_max_ht:12},
      {min_quantity:12,price_min_ht:9,price_max_ht:11},
    ]);
    expect(adminPreviewFirstTierLabel(pricing,6,6).amount).toContain("10");
  });

  it("uses validated pharmacy contract tiers only when contractual access is enabled",()=>{
    const pricing=resolveAdminPreviewPricing({
      productId:"a",minimumQuantity:6,pricingMode:"contractual",indicative,
      contractual:[
        {product_id:"a",min_quantity:6,price_ht:8.5},
        {product_id:"a",min_quantity:12,price_ht:7.5},
      ],
      flat:[{product_id:"a",price_ht:9.25}],
    });
    expect(pricing).toEqual({mode:"contractual",tiers:[
      {min_quantity:6,price_ht:8.5},{min_quantity:12,price_ht:7.5},
    ]});
    expect(adminPreviewFirstTierLabel(pricing,6,6).detail).toContain("contractuel");
  });

  it("uses the legacy pharmacy flat price only when the minimum has no explicit tier",()=>{
    const pricing=resolveAdminPreviewPricing({
      productId:"a",minimumQuantity:6,pricingMode:"contractual",indicative,
      contractual:[{product_id:"a",min_quantity:12,price_ht:8.5}],
      flat:[{product_id:"a",price_ht:9.5}],
    });
    expect(pricing).toEqual({mode:"contractual",tiers:[
      {min_quantity:6,price_ht:9.5},{min_quantity:12,price_ht:8.5},
    ]});
  });

  it("falls back to indicative tiers if a pharmacy has no contractual prices",()=>{
    const pricing=resolveAdminPreviewPricing({
      productId:"a",minimumQuantity:6,pricingMode:"contractual",
      indicative,contractual:[],flat:[],
    });
    expect(pricing.mode).toBe("indicative");
  });

  it("does not fabricate a price without published customer tiers",()=>{
    const pricing=resolveAdminPreviewPricing({
      productId:"c",minimumQuantity:6,pricingMode:"indicative",
      indicative,contractual:[],flat:[],
    });
    expect(adminPreviewFirstTierLabel(pricing,6,6).amount).toBe("Tarif sur demande");
  });
});
