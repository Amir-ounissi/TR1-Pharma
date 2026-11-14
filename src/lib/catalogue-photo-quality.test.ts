import { describe, expect, it } from "vitest";
import { preferredVerifiedPackshot, shopifyResponsivePhoto } from "@/lib/catalogue-photo-quality";

describe("catalogue : photographies HD et vérification des sources", () => {
  it("privilégie une photo officielle présente dans la galerie validée pour l'EAN", () => {
    const thirdParty = "https://retailer.example.com/product-123.jpg";
    const verifiedOfficial = "https://beautyofjoseon.com/cdn/shop/files/product-123.jpg?v=10";
    expect(preferredVerifiedPackshot(thirdParty, [
      "https://another-retailer.example.com/lifestyle.jpg",
      verifiedOfficial,
    ])).toBe(verifiedOfficial);
  });

  it("conserve la photo liée à la référence lorsqu'aucune photo officielle n'est validée", () => {
    const thirdParty = "https://retailer.example.com/packshot.jpg";
    expect(preferredVerifiedPackshot(thirdParty, [
      "https://another-retailer.example.com/lifestyle.jpg",
    ])).toBe(thirdParty);
    expect(preferredVerifiedPackshot(null, [])).toBeNull();
  });

  it("demande une résolution appropriée selon la taille de la photo", () => {
    const original = "https://biodance.com/cdn/shop/files/mask.png?v=3&width=1920";
    expect(shopifyResponsivePhoto(original, 320)).toContain("width=320");
    expect(shopifyResponsivePhoto(original, 960)).toContain("width=960");
    expect(shopifyResponsivePhoto(original, 1600)).toContain("width=1600");
    expect(shopifyResponsivePhoto(original, 1600)).toContain("v=3");
  });

  it("ne modifie pas les autres hébergeurs ni les URL non sûres", () => {
    const legacy = "https://cdn-image.oliveyoung.com/prdtImg/abc.jpg?QT=85";
    expect(shopifyResponsivePhoto(legacy, 960)).toBe(legacy);
    const unsafe = "http://example.com/packshot.jpg";
    expect(shopifyResponsivePhoto(unsafe, 960)).toBe(unsafe);
    expect(shopifyResponsivePhoto(legacy, 9999)).toBe(legacy);
  });
});
