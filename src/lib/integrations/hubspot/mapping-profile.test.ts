import { describe, expect, it } from "vitest";
import {
  buildHubSpotRuntimeProfile,
  resolveHubSpotMappedValue,
} from "./mapping-profile";
import { NAALI_HUBSPOT_CONFIGURATION } from "./naali";

describe("HubSpot admin mapping profiles", () => {
  it("keeps the Naali defaults when no admin mapping exists", () => {
    const profile = buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "orders",
    });

    expect(profile.config.properties.order.amountHt).toBe("amount");
    expect(profile.config.properties.meeting.body).toBe("hs_meeting_body");
    expect(NAALI_HUBSPOT_CONFIGURATION.properties.order.amountHt).toBe("amount");
  });

  it("overrides only allowlisted order properties", () => {
    const profile = buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "orders",
      mapping: {
        order: {
          amountHt: "custom_ca_ht",
          ownerId: "custom_owner",
          productExternalId: "must_be_ignored",
        },
      },
    });

    expect(profile.config.properties.order.amountHt).toBe("custom_ca_ht");
    expect(profile.config.properties.order.ownerId).toBe("custom_owner");
    expect(profile.config.properties.order.productExternalId).toBeUndefined();
    expect(NAALI_HUBSPOT_CONFIGURATION.properties.order.amountHt).toBe("amount");
  });

  it("allows an optional HubSpot property to be disabled", () => {
    const profile = buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "orders",
      mapping: { order: { currency: "" } },
    });

    expect(profile.config.properties.order.currency).toBeUndefined();
  });

  it("uses admin order value mappings and supports an explicit no-send value", () => {
    const profile = buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "orders",
      transforms: {
        orderTypeValues: {
          other: "Commande différée",
          replacement: "",
        },
      },
    });

    expect(resolveHubSpotMappedValue(profile.transforms.orderTypeValues, "other", null)).toBe("Commande différée");
    expect(resolveHubSpotMappedValue(profile.transforms.orderTypeValues, "replacement", "Réassort")).toBeNull();
    expect(resolveHubSpotMappedValue(profile.transforms.orderTypeValues, "reorder", "Réassort")).toBe("Réassort");
  });

  it("overrides meeting properties and exact HubSpot activity values", () => {
    const profile = buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "visits",
      mapping: { meeting: { body: "custom_visit_report", activityType: "custom_activity_type" } },
      transforms: { visitTypeValues: { training: "Formation" } },
    });

    expect(profile.config.properties.meeting.body).toBe("custom_visit_report");
    expect(profile.config.properties.meeting.activityType).toBe("custom_activity_type");
    expect(resolveHubSpotMappedValue(profile.transforms.visitTypeValues, "training", null)).toBe("Formation");
  });

  it("rejects unsafe property names and unsupported HubSpot values", () => {
    expect(() => buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "orders",
      mapping: { order: { amountHt: "amount;DROP TABLE" } },
    })).toThrow(/Invalid HubSpot property override/);

    expect(() => buildHubSpotRuntimeProfile({
      baseConfig: NAALI_HUBSPOT_CONFIGURATION,
      entityType: "visits",
      transforms: { visitTypeValues: { training: "Inventé" } },
    })).toThrow(/Unsupported HubSpot mapped value/);
  });
});
