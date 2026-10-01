import { describe, expect, it } from "vitest";
import {
  frenchVatLookupInternals,
  lookupFrenchVatNumber,
} from "./fr-vat-lookup";

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("French VAT lookup", () => {
  it("normalizes French postal codes and names", () => {
    expect(frenchVatLookupInternals.normalizePostalCode("6100")).toBe("06100");
    expect(frenchVatLookupInternals.normalizeName("Pharmacie de l'Europe")).toBe("PHARMACIE DE L EUROPE");
    expect(
      frenchVatLookupInternals.nameScore(
        "Grande Pharmacie du Pontet",
        "GRANDE PHARMACIE DU PONTET",
      ),
    ).toBe(1);
  });

  it("finds an official VAT from a confident name and postcode match", async () => {
    const fetcher = (() =>
      response({
        results: [
          {
            siren: "123456789",
            nom_complet: "GRANDE PHARMACIE DU PONTET",
            nom_raison_sociale: "SELARL GRANDE PHARMACIE DU PONTET",
            tva: ["FR32123456789"],
            siege: {
              siret: "12345678900011",
              code_postal: "84130",
              etat_administratif: "A",
              liste_enseignes: ["GRANDE PHARMACIE DU PONTET"],
            },
            matching_etablissements: [],
          },
        ],
      })) as typeof fetch;

    const result = await lookupFrenchVatNumber(
      {
        tradeName: "Grande Pharmacie du Pontet",
        legalName: "Grande Pharmacie du Pontet",
        postalCode: "84130",
        city: "Le Pontet",
      },
      fetcher,
    );

    expect(result).toEqual({
      status: "found",
      vatNumber: "FR32123456789",
      siren: "123456789",
      siret: "12345678900011",
      companyName: "SELARL GRANDE PHARMACIE DU PONTET",
      source: "annuaire-entreprises",
    });
  });

  it("accepts a direct SIRET lookup even when the company name differs", async () => {
    const fetcher = (() =>
      response({
        results: [
          {
            siren: "987654321",
            nom_complet: "PHARMACIE DU PRADO",
            nom_raison_sociale: "SELARL PHARMACIE DU PRADO",
            tva: ["FR11987654321"],
            siege: {
              siret: "98765432100022",
              code_postal: "13008",
            },
            matching_etablissements: [],
          },
          {
            siren: "123456789",
            nom_complet: "SELARL ABC",
            nom_raison_sociale: "SELARL ABC",
            tva: ["FR32123456789"],
            siege: {
              siret: "12345678900011",
              code_postal: "13008",
            },
            matching_etablissements: [],
          },
        ],
      })) as typeof fetch;

    const result = await lookupFrenchVatNumber(
      {
        siret: "12345678900011",
        tradeName: "Pharmacie du Prado",
        postalCode: "13008",
      },
      fetcher,
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.vatNumber).toBe("FR32123456789");
      expect(result.siret).toBe("12345678900011");
    }
  });

  it("refuses to write when two companies are similarly plausible", async () => {
    const fetcher = (() =>
      response({
        results: [
          {
            siren: "111111111",
            nom_complet: "PHARMACIE SAINT MARTIN",
            tva: ["FR11111111111"],
            siege: { siret: "11111111100011", code_postal: "34070" },
          },
          {
            siren: "222222222",
            nom_complet: "PHARMACIE SAINT MARTIN",
            tva: ["FR22222222222"],
            siege: { siret: "22222222200022", code_postal: "34070" },
          },
        ],
      })) as typeof fetch;

    const result = await lookupFrenchVatNumber(
      {
        tradeName: "Pharmacie Saint Martin",
        postalCode: "34070",
      },
      fetcher,
    );

    expect(result.status).toBe("ambiguous");
  });

  it("refuses an entity with several active VAT numbers", async () => {
    const fetcher = (() =>
      response({
        results: [
          {
            siren: "123456789",
            nom_complet: "PHARMACIE TEST",
            tva: ["FR32123456789", "FR99123456789"],
            siege: { siret: "12345678900011", code_postal: "13008" },
          },
        ],
      })) as typeof fetch;

    const result = await lookupFrenchVatNumber(
      {
        tradeName: "Pharmacie Test",
        postalCode: "13008",
      },
      fetcher,
    );

    expect(result.status).toBe("not_found");
  });
});
