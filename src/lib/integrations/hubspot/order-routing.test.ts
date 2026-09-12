import { describe, expect, it } from "vitest";
import { mapOrderToHubSpot } from "./mappers";
import { NAALI_HUBSPOT_CONFIGURATION, resolveNaaliHubSpotOrderRoute } from "./naali";

const order = {
  id: "order-routing-1",
  orderNumber: "CMD-ROUTING-1",
  status: "confirmed",
  orderDate: "2026-09-07T12:00:00.000Z",
  netAmountHt: 1947.26,
  taxAmount: 107.1,
  amountTtc: 2054.36,
  currency: "EUR",
  ownerExternalId: "727665403",
  lines: [],
};

describe("Naali HubSpot order routing", () => {
  it("routes internal Naali users to the commercial pipeline and origin", () => {
    const route = resolveNaaliHubSpotOrderRoute("brand_admin");
    const mapped = mapOrderToHubSpot({
      ...order,
      pipelineExternalId: route.pipeline,
      stageExternalId: route.confirmedStage,
      originValue: route.origin,
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.deal.properties).toMatchObject({
      hubspot_owner_id: "727665403",
      pipeline: "1543644371",
      dealstage: "5786904809",
      origine_de_la_commande: "Commercial Naali",
    });
  });

  it("routes Amir Ounissi to the commercial pipeline even when his TR1 role is agent", () => {
    const route = resolveNaaliHubSpotOrderRoute("agent", "727665403");
    const mapped = mapOrderToHubSpot({
      ...order,
      status: "pending",
      pipelineExternalId: route.pipeline,
      stageExternalId: route.confirmedStage,
      originValue: route.origin,
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.deal.properties).toMatchObject({
      hubspot_owner_id: "727665403",
      pipeline: "1543644371",
      dealstage: "5786904809",
      origine_de_la_commande: "Commercial Naali",
    });
  });

  it("routes other submitted partner-agent orders to the agent pipeline and equivalent ADV stage", () => {
    const route = resolveNaaliHubSpotOrderRoute("agent", "999999999");
    const mapped = mapOrderToHubSpot({
      ...order,
      ownerExternalId: "999999999",
      status: "pending",
      pipelineExternalId: route.pipeline,
      stageExternalId: route.confirmedStage,
      originValue: route.origin,
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.deal.properties).toMatchObject({
      hubspot_owner_id: "999999999",
      pipeline: "1543733493",
      dealstage: "5787550915",
      origine_de_la_commande: "Agent",
    });
  });

  it("keeps draft orders out of HubSpot", () => {
    const route = resolveNaaliHubSpotOrderRoute("brand_admin");
    expect(() => mapOrderToHubSpot({
      ...order,
      status: "draft",
      pipelineExternalId: route.pipeline,
      stageExternalId: route.confirmedStage,
      originValue: route.origin,
    }, NAALI_HUBSPOT_CONFIGURATION)).toThrow(/not configured/);
  });

  it("refuses to guess a HubSpot route for unsupported TR1 roles", () => {
    expect(() => resolveNaaliHubSpotOrderRoute("facilitator")).toThrow(/Unsupported TR1 role/);
  });
});
