import { describe, expect, it } from "vitest";
import { KOREAN_FRANCO, koreanFrancoProgress, isKoreanFrancoBrand } from "@/lib/catalogue-shipping";

describe("franco multimarque coréen à 250 EUR HT remisé", () => {
  it("cumule Biodance, Beauty of Joseon et Dr. Althea après application des prix par palier", () => {
    const progress = koreanFrancoProgress([
      {brandSlug:"biodance",quantity:24,unitPriceMinCents:352,unitPriceMaxCents:352},
      {brandSlug:"beauty-of-joseon",quantity:10,unitPriceMinCents:1200,unitPriceMaxCents:1200},
      {brandSlug:"dr-althea",quantity:4,unitPriceMinCents:1200,unitPriceMaxCents:1200},
      {brandSlug:"vk-swiss",quantity:100,unitPriceMinCents:2000,unitPriceMaxCents:2000},
    ]);
    expect(progress.totalMinCents).toBe(25248);
    expect(progress.status).toBe("reached");
    expect(progress.brands).toHaveLength(3);
  });
  it("n'impute pas les autres marques et affiche le manque avant franco", () => {
    const progress=koreanFrancoProgress([
      {brandSlug:"beauty-of-joseon",quantity:10,unitPriceMinCents:1500,unitPriceMaxCents:1500},
      {brandSlug:"vk-swiss",quantity:50,unitPriceMinCents:900,unitPriceMaxCents:900},
    ]);
    expect(progress.status).toBe("below");
    expect(progress.missingMinCents).toBe(10000);
    expect(progress.missingMaxCents).toBe(10000);
    expect(KOREAN_FRANCO.thresholdCents).toBe(25000);
    expect(isKoreanFrancoBrand("vk-swiss")).toBe(false);
  });
  it("ne promet pas le franco si des prix indicatifs pourraient descendre sous le seuil",()=>{
    expect(koreanFrancoProgress([
      {brandSlug:"biodance",quantity:20,unitPriceMinCents:1200,unitPriceMaxCents:1400},
    ]).status).toBe("uncertain");
    expect(koreanFrancoProgress([
      {brandSlug:"dr-althea",quantity:2,unitPriceMinCents:null,unitPriceMaxCents:null},
    ]).status).toBe("uncertain");
  });
});
