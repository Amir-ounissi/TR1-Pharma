import { describe, expect, it } from "vitest";
import {
  applyHubSpotFieldMapping,
  defaultHubSpotFieldMapping,
  normalizeHubSpotFieldMapping,
} from "./mapping-profile";
import { NAALI_HUBSPOT_CONFIGURATION } from "./naali";

describe("HubSpot field mapping profiles", () => {
  it("exposes the current Naali mapping as the default admin mapping", () => {
    const defaults = defaultHubSpotFieldMapping(NAALI_HUBSPOT_CONFIGURATION, "visits");
    expect(defaults["meeting.name"]).toBe("hs_meeting_title");
    expect(defaults["meeting.activityType"]).toBe("hs_activity_type");
  });

  it("overrides only the selected order and line item HubSpot properties", () => {
    const config = applyHubSpotFieldMapping(NAALI_HUBSPOT_CONFIGURATION, "orders", {
      "order.orderType": "custom_order_type",
      "lineItem.discountPercent": "custom_discount",
    });

    expect(config.properties.order.orderType).toBe("custom_order_type");
    expect(config.properties.lineItem.discountPercent).toBe("custom_discount");
    expect(config.properties.order.amountHt).toBe("amount");
    expect(NAALI_HUBSPOT_CONFIGURATION.properties.order.orderType).toBe("type_de_commande");
  });

  it("applies visit and note mappings independently", () => {
    const visitConfig = applyHubSpotFieldMapping(NAALI_HUBSPOT_CONFIGURATION, "visits", {
      "meeting.body": "custom_visit_report",
    });
    const noteConfig = applyHubSpotFieldMapping(NAALI_HUBSPOT_CONFIGURATION, "notes", {
      "note.body": "custom_note_body",
    });

    expect(visitConfig.properties.meeting.body).toBe("custom_visit_report");
    expect(visitConfig.properties.note.body).toBe("hs_note_body");
    expect(noteConfig.properties.note.body).toBe("custom_note_body");
    expect(noteConfig.properties.meeting.body).toBe("hs_meeting_body");
  });

  it("removes a HubSpot property when the admin leaves its mapping blank", () => {
    const config = applyHubSpotFieldMapping(NAALI_HUBSPOT_CONFIGURATION, "visits", {
      "meeting.internalNotes": null,
    });

    expect(config.properties.meeting.internalNotes).toBeUndefined();
    expect(NAALI_HUBSPOT_CONFIGURATION.properties.meeting.internalNotes).toBe("hs_internal_meeting_notes");
  });

  it("rejects unsupported keys and unsafe HubSpot property names", () => {
    expect(() => normalizeHubSpotFieldMapping("visits", { "meeting.unknown": "foo" })).toThrow(/Unsupported/);
    expect(() => normalizeHubSpotFieldMapping("visits", { "meeting.body": "bad field name" })).toThrow(/Invalid/);
  });
});
