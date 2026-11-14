import { describe, expect, it } from "vitest";
import { productGalleryByEan, productGalleryByName } from "@/lib/catalogue-product-photos";

describe("catalogue product image galleries", () => {
  it("provides several verified visuals for the enriched product references", () => {
    for (const ean of [
      "8809447256221", "8809447256795", "8809447256412", "8809447256115",
      "8809525249565", "8809738314678", "8809738312728", "8809782555508",
      "8809937361718", "8809937361725", "8809891184583", "8809891184569",
    ]) {
      expect(productGalleryByEan[ean]?.length, ean).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps galleries tied to the correct packaging size", () => {
    expect(productGalleryByEan["8809447256115"].some((url) => url.includes("345_100ml"))).toBe(true);
    expect(productGalleryByEan["8809447256122"].some((url) => url.includes("345_100ml"))).toBe(false);
    expect(productGalleryByEan["8809525249565"].length).toBeGreaterThan(1);
    expect(productGalleryByEan["8809954941498"]).toBeUndefined();
    expect(productGalleryByEan["8809738314678"].length).toBeGreaterThan(1);
    expect(productGalleryByEan["8809968132172"]).toBeUndefined();
  });

  it("uses single-sheet images for Biodance single-mask SKUs", () => {
    const bioCollagen = productGalleryByEan["8809937361718"];
    const vita = productGalleryByEan["8809891184583"];
    const seaKelp = productGalleryByEan["8809891184569"];
    expect(bioCollagen.some((url) => url.includes("shop-apotheke.com/images/mp/prod"))).toBe(true);
    expect(vita.some((url) => url.includes("8809891184583.webp"))).toBe(true);
    expect(seaKelp.some((url) => url.includes("Packshot.jpg"))).toBe(true);
    expect(seaKelp.some((url) => /4.?pack|4.?sheets|x4/i.test(url))).toBe(false);
  });

  it("adds exact-name galleries to Biodance products without EANs", () => {
    for (const name of [
      "Pore Perfecting Collagen Peptide Serum",
      "Radiant Vita Niacinamide Serum",
      "Refreshing Sea Kelp Serum",
      "Collagen Gel Toner Pads",
      "Cera-nol Gel Toner Pads",
      "Sea Kelp Gel Toner Pads",
      "Collagen Peptide Eye Patches",
    ]) {
      expect(productGalleryByName[name]?.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it("does not repeat identical image URLs within a gallery", () => {
    for (const [ean, urls] of Object.entries(productGalleryByEan)) {
      expect(new Set(urls).size, ean).toBe(urls.length);
    }
    for (const [name, urls] of Object.entries(productGalleryByName)) {
      expect(new Set(urls).size, name).toBe(urls.length);
    }
  });
});
