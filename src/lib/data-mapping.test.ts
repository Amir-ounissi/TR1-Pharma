import { describe, expect, it } from "vitest";
import {
  IGNORE_MAPPING_TARGET,
  suggestCanonicalField,
  validateDataMapping,
} from "./data-mapping";

describe("Data Mapping Studio", () => {
  it("suggère les champs TR1 à partir d’alias métier", () => {
    expect(suggestCanonicalField("Nom pharmacie", "pharmacies")).toBe("legal_name");
    expect(suggestCanonicalField("ACL FR", "products")).toBe("sku");
    expect(suggestCanonicalField("Quantité", "orders")).toBe("quantity");
  });

  it("refuse un profil qui oublie un champ obligatoire", () => {
    expect(validateDataMapping("products", { Produit: "name" })).toContain(
      "Champ obligatoire non mappé : sku",
    );
  });

  it("refuse deux colonnes sources vers le même champ", () => {
    const errors = validateDataMapping("products", {
      Produit: "name",
      Libelle: "name",
      ACL: "sku",
    });
    expect(errors.some((error) => error.includes("mappé plusieurs fois"))).toBe(true);
  });

  it("autorise explicitement les colonnes ignorées", () => {
    expect(
      validateDataMapping("pharmacies", {
        "Nom officine": "legal_name",
        "Commentaire libre": IGNORE_MAPPING_TARGET,
      }),
    ).toEqual([]);
  });
});
