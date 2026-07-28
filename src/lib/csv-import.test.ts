import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv-import";

describe("parseCsv", () => {
  it("prévisualise un fichier valide sans écrire", () => {
    const preview = parseCsv("legal_name;trade_name;siret\nPharmacie Test;Test;12345678901234", "pharmacies");
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].isValid).toBe(true);
    expect(preview.rows[0].normalizedPayload.siret).toBe("12345678901234");
  });

  it("signale une colonne obligatoire manquante", () => {
    const preview = parseCsv("trade_name;city\nTest;Paris", "pharmacies");
    expect(preview.rows[0].errors).toContain("Colonne manquante : legal_name");
  });

  it("signale les formats invalides", () => {
    const preview = parseCsv("name;sku;wholesale_price_ht\nProduit;SKU-1;abc", "products");
    expect(preview.rows[0].isValid).toBe(false);
    expect(preview.rows[0].errors).toContain("Prix de gros invalide");
  });

  it("gère les champs entre guillemets", () => {
    const preview = parseCsv('legal_name,city\n"Pharmacie, Centrale",Lyon', "pharmacies");
    expect(preview.rows[0].normalizedPayload.legal_name).toBe("Pharmacie, Centrale");
  });

  it("valide les colonnes minimales d’une ligne de commande", () => {
    const preview = parseCsv("external_order_id;order_date;brand_pharmacy_id;product_id;quantity;unit_price_ht\nCMD-1;2026-07-21;11111111-1111-4111-8111-111111111111;22222222-2222-4222-8222-222222222222;2;10,50", "orders");
    expect(preview.rows[0].isValid).toBe(true);
    expect(preview.rows[0].normalizedPayload.unit_price_ht).toBe("10.50");
  });

  it("refuse une ligne de commande sans identifiants métier", () => {
    const preview = parseCsv("external_order_id;order_date;quantity;unit_price_ht\nCMD-1;2026-07-21;0;abc", "orders");
    expect(preview.rows[0].errors).toContain("Identifiant pharmacie manquant");
    expect(preview.rows[0].errors).toContain("Identifiant produit manquant");
    expect(preview.rows[0].errors).toContain("Quantité invalide");
  });
});
