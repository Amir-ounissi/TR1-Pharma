import { describe, expect, it } from "vitest";
import {
  catalogueAccessRequestSchema,
  isValidSiret,
  formatCatalogueAccessRequest,
  normalizeCatalogueAccessRequest,
} from "./catalogue-access";

const validRequest = {
  fullName: "Marie Martin",
  role: "titulaire",
  professionalEmail: "MARIE@PHARMACIE.EXAMPLE",
  phone: "+33 6 12 34 56 78",
  pharmacyName: "Pharmacie du Centre",
  addressLine: "12 rue de la République",
  postalCode: "13800",
  city: "Istres",
  siret: "",
  finess: "123456789",
  pharmacyConfirmation: "true",
  privacyAcknowledged: "true",
  website: "",
};

describe("catalogue pharmacy access identifiers", () => {
  it("accepts a valid SIRET", () => {
    expect(isValidSiret("73282932000074")).toBe(true);
  });

  it("rejects a SIRET with an invalid check digit", () => {
    expect(isValidSiret("73282932000075")).toBe(false);
  });

  it("accepts a pharmacy request with a FINESS identifier", () => {
    expect(catalogueAccessRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("requires at least one SIRET or FINESS identifier", () => {
    const result = catalogueAccessRequestSchema.safeParse({ ...validRequest, finess: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed FINESS identifier", () => {
    const result = catalogueAccessRequestSchema.safeParse({ ...validRequest, finess: "12345" });
    expect(result.success).toBe(false);
  });

  it("normalizes French international phone numbers and email addresses", () => {
    const parsed = catalogueAccessRequestSchema.parse(validRequest);
    const normalized = normalizeCatalogueAccessRequest(parsed);
    expect(normalized.phone).toBe("0612345678");
    expect(normalized.professionalEmail).toBe("marie@pharmacie.example");
  });
});


describe("public catalogue product interest", () => {
  it("preserves a selected product in the request received by TR1", () => {
    const input = normalizeCatalogueAccessRequest(catalogueAccessRequestSchema.parse({ ...validRequest, interest: " Vitalora  —  Magnésium " }));
    expect(formatCatalogueAccessRequest(input, "2026-11-21")).toContain("Marque ou produit souhaité : Vitalora — Magnésium");
  });
  it("keeps generic access requests valid without a selection", () => {
    const input = catalogueAccessRequestSchema.parse(validRequest);
    expect(formatCatalogueAccessRequest(input, "2026-11-21")).not.toContain("Marque ou produit souhaité");
  });
  it("rejects oversized selections before lead capture", () => {
    expect(catalogueAccessRequestSchema.safeParse({ ...validRequest, interest: "x".repeat(201) }).success).toBe(false);
  });
});
