import { describe, expect, it } from "vitest";
import { mapMeetingToHubSpot, mapOrderToHubSpot } from "./mappers";
import {
  NAALI_HUBSPOT_AMIR_OWNER_ID,
  NAALI_HUBSPOT_CONFIGURATION,
  requireNaaliHubSpotOrderType,
  resolveNaaliHubSpotOrderType,
  resolveNaaliHubSpotVisitType,
} from "./naali";

describe("Naali HubSpot activity mapping", () => {
  it("maps a TR1 client visit to a HubSpot meeting with owner, type and report body", () => {
    const mapped = mapMeetingToHubSpot({
      id: "visit-1",
      title: "Visite · Pharmacie Test",
      startAt: "2026-09-11T08:00:00.000Z",
      endAt: "2026-09-11T08:45:00.000Z",
      outcome: "COMPLETED",
      ownerExternalId: "29117704",
      activityType: resolveNaaliHubSpotVisitType("client_visit"),
      body: "Compte rendu de visite",
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.properties).toMatchObject({
      hs_meeting_title: "Visite · Pharmacie Test",
      hs_meeting_start_time: "2026-09-11T08:00:00.000Z",
      hs_timestamp: "2026-09-11T08:00:00.000Z",
      hs_meeting_end_time: "2026-09-11T08:45:00.000Z",
      hs_meeting_outcome: "COMPLETED",
      hubspot_owner_id: "29117704",
      hs_activity_type: "Visite client",
      hs_meeting_body: "Compte rendu de visite",
    });
    expect(mapped.properties.hs_note_body).toBeUndefined();
  });

  it("uses the exact Naali HubSpot activity values for current TR1 visit kinds", () => {
    expect(resolveNaaliHubSpotVisitType("client_visit")).toBe("Visite client");
    expect(resolveNaaliHubSpotVisitType("prospecting")).toBe("Visite prospection");
    expect(resolveNaaliHubSpotVisitType("relationship")).toBe("Rendez-vous client");
    expect(resolveNaaliHubSpotVisitType("merchandising")).toBe("Visite client");
    expect(resolveNaaliHubSpotVisitType("sell_out")).toBe("Visite client");
  });

  it("refuses to invent a HubSpot activity type for an unknown visit kind", () => {
    expect(() => resolveNaaliHubSpotVisitType("unknown")).toThrow(/Unsupported TR1 visit kind/);
  });
});

describe("Naali HubSpot order mapping", () => {
  it("maps unambiguous TR1 order types to the exact HubSpot values", () => {
    expect(resolveNaaliHubSpotOrderType("initial")).toBe("Implantation");
    expect(resolveNaaliHubSpotOrderType("reorder")).toBe("Réassort");
    expect(resolveNaaliHubSpotOrderType("other")).toBeNull();
  });

  it("uses the verified HubSpot owner ID for Amir Ounissi", () => {
    expect(NAALI_HUBSPOT_AMIR_OWNER_ID).toBe("727665403");
  });

  it("requires a supported type for every synced Naali order deal", () => {
    expect(requireNaaliHubSpotOrderType("initial")).toBe("Implantation");
    expect(requireNaaliHubSpotOrderType("reorder")).toBe("Réassort");
    expect(() => requireNaaliHubSpotOrderType(null)).toThrow(/mandatory Naali HubSpot type_de_commande/);
    expect(() => requireNaaliHubSpotOrderType("complementary")).toThrow(/mandatory Naali HubSpot type_de_commande/);
  });

  it("writes type_de_commande only when TR1 supplied an unambiguous HubSpot value", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-1",
      orderNumber: "CMD-001",
      status: "confirmed",
      orderDate: "2026-09-11T09:00:00.000Z",
      orderTypeValue: "Réassort",
      ownerExternalId: "32320882",
      orderTakenByExternalId: "29151394",
      netAmountHt: 100,
      currency: "EUR",
      lines: [],
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.deal.properties.type_de_commande).toBe("Réassort");
    expect(mapped.deal.properties.hubspot_owner_id).toBe("32320882");
    expect(mapped.deal.properties.prise_de_commande).toBe("29151394");
  });

  it("omits prise_de_commande while its HubSpot enum lacks Amir", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-without-taking-option",
      orderNumber: "CMD-002",
      status: "confirmed",
      orderDate: "2026-10-14T09:00:00.000Z",
      orderTypeValue: "Implantation",
      ownerExternalId: NAALI_HUBSPOT_AMIR_OWNER_ID,
      netAmountHt: 150,
      currency: "EUR",
      lines: [],
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.deal.properties.type_de_commande).toBe("Implantation");
    expect(mapped.deal.properties.hubspot_owner_id).toBe(NAALI_HUBSPOT_AMIR_OWNER_ID);
    expect(mapped.deal.properties).not.toHaveProperty("prise_de_commande");
  });

  it("writes the Naali tax-rate group for a 5.5% order line", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-tax",
      orderNumber: "CMD-TAX",
      status: "pending",
      orderDate: "2026-09-11T09:00:00.000Z",
      netAmountHt: 100,
      currency: "EUR",
      lines: [{
        id: "line-1",
        productId: "product-1",
        productExternalId: "hubspot-product-1",
        name: "Produit test",
        sku: "sku-test",
        quantity: 6,
        unitPriceHt: 10,
        discountPercent: 35,
        vatRate: 5.5,
      }],
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.lineItems[0]?.properties.hs_tax_rate_group_id).toBe("115989351");
  });

  it("classifies Naali UG as client commercial conditions in HubSpot", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-ug",
      orderNumber: "CMD-UG",
      status: "pending",
      orderDate: "2026-09-11T09:00:00.000Z",
      netAmountHt: 442.1,
      currency: "EUR",
      lines: [{
        id: "line-ug",
        productId: "product-ug",
        productExternalId: "172418389203",
        freeProductExternalId: "hubspot-ug-product",
        name: "Gommes Anti Stress x60",
        sku: "1antistress60",
        quantity: 24,
        freeQuantity: 4,
        unitPriceHt: 28.34,
        discountPercent: 35,
        vatRate: 5.5,
      }],
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.lineItems[1]?.properties).toMatchObject({
      type_de_produit_naali: "UG",
      primary_product_id: "172418389203",
      quantity: "4",
      price: "0",
      hs_tax_rate_group_id: "115989351",
      test_type_dug: "conditions commerciale client",
    });
  });
  it("preserves commercial Collagène and expired Mango compensation as distinct HubSpot reasons", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-auchan", orderNumber: "TEST-AUCHAN", status: "pending",
      orderDate: "2026-10-15T08:00:00.000Z", netAmountHt: 317.15,
      lines: [
        {
          id: "collagene", productId: "collagene", productExternalId: "hs-collagene",
          freeProductExternalId: "hs-collagene-ug", name: "Collagène Citron-Vert Menthe",
          quantity: 12, freeQuantity: 2,
          freeUnitAllocations: [{ source: "commercial_terms", quantity: 2,
            classification: "conditions commerciales client" }],
          unitPriceHt: 40.66, discountPercent: 35, vatRate: 5.5,
        },
        {
          id: "mangue", productId: "mangue", productExternalId: "hs-mangue",
          freeProductExternalId: "hs-mangue-ug", name: "Gommes Anti Stress x60",
          quantity: 0, freeQuantity: 3,
          freeUnitAllocations: [{ source: "manual", quantity: 3,
            classification: "échange périmé" }],
          unitPriceHt: 28.34, discountPercent: 35, vatRate: 5.5,
        },
      ],
    }, NAALI_HUBSPOT_CONFIGURATION);
    expect(mapped.lineItems).toHaveLength(3);
    expect(mapped.lineItems.map((line) => [line.tr1RecordId,
      line.properties.quantity, line.properties.test_type_dug])).toEqual([
      ["collagene", "12", undefined],
      ["collagene:free", "2", "conditions commerciale client"],
      ["mangue:free", "3", "échange périmé"],
    ]);
    expect(mapped.lineItems[2]?.properties.price).toBe("0");
  });

  it("splits a single reference into separate commercial and manual UG lines", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-split", orderNumber: "TEST-SPLIT", status: "pending",
      orderDate: "2026-10-15T08:00:00.000Z", netAmountHt: 221.05,
      lines: [{
        id: "anti-stress", productId: "anti-stress", productExternalId: "hs-stress",
        freeProductExternalId: "hs-stress-ug", name: "Gommes Anti Stress x60",
        quantity: 12, freeQuantity: 19,
        freeUnitAllocations: [
          { source: "manual", quantity: 17, classification: "échange périmé" },
          { source: "commercial_terms", quantity: 2, classification: "conditions commerciales client" },
        ],
        unitPriceHt: 28.34, discountPercent: 35, vatRate: 5.5,
      }],
    }, NAALI_HUBSPOT_CONFIGURATION);
    expect(mapped.lineItems.map((line) => [line.tr1RecordId,
      line.properties.quantity, line.properties.test_type_dug])).toEqual([
      ["anti-stress", "12", undefined],
      ["anti-stress:free:commercial_terms", "2", "conditions commerciale client"],
      ["anti-stress:free:manual", "17", "échange périmé"],
    ]);
  });

  it("blocks transmission when recorded UG reasons do not cover all free units", () => {
    expect(() => mapOrderToHubSpot({
      id: "order-mismatch", orderNumber: "BAD", status: "pending",
      orderDate: "2026-10-15T08:00:00.000Z", netAmountHt: 221.05,
      lines: [{
        id: "item", productId: "product", productExternalId: "hs-normal",
        freeProductExternalId: "hs-ug", name: "Produit test",
        quantity: 12, freeQuantity: 5,
        freeUnitAllocations: [{ source: "manual", quantity: 3,
          classification: "échange périmé" }],
        unitPriceHt: 28.34,
      }],
    }, NAALI_HUBSPOT_CONFIGURATION)).toThrow(/UG classification\/quantity mismatch/);
  });

  it("maps a verified Black Friday 2026 preorder into the trade pipeline and consumer gifts", () => {
    const lines = [
      { id: "as-20", productId: "as-20", productExternalId: "37677518042",
        freeProductExternalId: "108803558618",
        name: "Sachet découverte Gommes Anti-Stress x20", quantity: 48, freeQuantity: 6,
        freeUnitAllocations: [{ source: "commercial_terms" as const, quantity: 6, classification: "conditions commerciales client" }],
        unitPriceHt: 10.33, discountPercent: 40, vatRate: 5.5 },
      { id: "kids", productId: "kids", productExternalId: "415729775816",
        freeProductExternalId: "415571299543",
        name: "Safran Kids", quantity: 48, freeQuantity: 6,
        freeUnitAllocations: [{ source: "commercial_terms" as const, quantity: 6, classification: "conditions commerciales client" }],
        unitPriceHt: 28.34, discountPercent: 40, vatRate: 5.5 },
    ];
    const mapped = mapOrderToHubSpot({
      id: "preorder-1", orderNumber: "492986", status: "pending",
      orderDate: "2026-10-15T12:00:00Z", orderTypeValue: "Réassort",
      netAmountHt: 1113.69, ownerExternalId: "727665403",
      stageExternalId: "2110945486", pipelineExternalId: "1543644371",
      orderTakenByExternalId: "727665403",
      blackFridayTrade: {
        campaign: "black_friday_2026", giftAntiStressQuantity: 54, giftDreamQuantity: 54,
        giftAntiStressProductExternalId: "434521369830",
        giftDreamProductExternalId: "434520650953",
      },
      lines,
    }, NAALI_HUBSPOT_CONFIGURATION);
    expect(mapped.deal.properties).toMatchObject({
      type_de_commande: "Réassort",
      type_de_precommande: "Précommande Opération Trade",
      closed_won_reason: "Black Friday 2026",
      dealstage: "2110945486",
      pipeline: "1543644371",
      prise_de_commande: "727665403",
    });
    expect(mapped.lineItems).toHaveLength(6);
    const gifts = mapped.lineItems.slice(-2);
    expect(gifts.map(x => [x.tr1RecordId, x.properties.name, x.properties.quantity,
      x.properties.price, x.properties.type_de_produit_naali])).toEqual([
      ["preorder-1:bf26:as", "Cadeau sell-out Black Friday 26 - Sachet Anti-Stress x20", "54", "0", "Autre"],
      ["preorder-1:bf26:dream", "Cadeau sell-out Black Friday 26 - Sachet Dream x20", "54", "0", "Autre"],
    ]);
    expect(gifts.map(x => x.properties.hs_product_id)).toEqual(["434521369830", "434520650953"]);
    expect(mapped.lineItems.filter(x => x.properties.test_type_dug === "conditions commerciale client")).toHaveLength(2);
  });

  it("refuses odd or tampered promotional gift quantities", () => {
    const base = {
      id: "bad-trade", orderNumber: "BAD", status: "pending",
      orderDate: "2026-10-15T12:00:00Z", orderTypeValue: "Réassort",
      netAmountHt: 100, lines: [],
    };
    expect(() => mapOrderToHubSpot({
      ...base, blackFridayTrade: {
        campaign: "black_friday_2026" as const,
        giftAntiStressQuantity: 88, giftDreamQuantity: 87,
        giftAntiStressProductExternalId: "434521369830", giftDreamProductExternalId: "434520650953",
      },
    }, NAALI_HUBSPOT_CONFIGURATION)).toThrow(/Invalid Black Friday gift allocation/);
  });

});
