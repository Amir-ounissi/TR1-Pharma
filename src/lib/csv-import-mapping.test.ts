import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv-import";
import { IGNORE_MAPPING_TARGET } from "./data-mapping";

describe("parseCsv avec profil de mapping", () => {
  it("importe un format source non canonique sans modifier le CSV", () => {
    const preview = parseCsv(
      "Officine;CP;Commune;Champ interne\nPharmacie des Lilas;75020;Paris;ABC",
      "pharmacies",
      {
        Officine: "legal_name",
        CP: "postal_code",
        Commune: "city",
        "Champ interne": IGNORE_MAPPING_TARGET,
      },
    );

    expect(preview.rows[0].isValid).toBe(true);
    expect(preview.rows[0].normalizedPayload).toMatchObject({
      legal_name: "Pharmacie des Lilas",
      postal_code: "75020",
      city: "Paris",
    });
    expect(preview.rows[0].normalizedPayload["Champ interne"]).toBeUndefined();
  });

  it("le mapping explicite est prioritaire sur les alias automatiques", () => {
    const preview = parseCsv(
      "Produit;ACL FR\nSKU-DETOURNE;Nom réel",
      "products",
      { Produit: "sku", "ACL FR": "name" },
    );

    expect(preview.rows[0].isValid).toBe(true);
    expect(preview.rows[0].normalizedPayload).toMatchObject({
      sku: "SKU-DETOURNE",
      name: "Nom réel",
    });
  });
});
