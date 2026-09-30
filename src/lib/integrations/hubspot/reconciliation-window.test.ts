import { describe, expect, it } from "vitest";
import {
  HUBSPOT_ORDER_BOOTSTRAP_DAYS,
  HUBSPOT_ORDER_REPLAY_DAYS,
  HUBSPOT_ORDER_RELEASE_MAX_STALENESS_HOURS,
  HUBSPOT_ORDER_RELEASE_REPLAY_MINUTES,
  resolveHubSpotOrderSyncSince,
  resolveHubSpotOrderSyncWindow,
  resolveHubSpotReleaseOrderSyncWindow,
} from "./reconciliation-window";

describe("HubSpot order reconciliation window", () => {
  const now = Date.parse("2026-09-25T18:00:00.000Z");

  it("bounds the first inbound order reconciliation", () => {
    expect(resolveHubSpotOrderSyncSince(null, now)).toBe(
      new Date(now - HUBSPOT_ORDER_BOOTSTRAP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("filters the first bootstrap by deal creation date", () => {
    expect(resolveHubSpotOrderSyncWindow(null, now)).toEqual({
      since: new Date(
        now - HUBSPOT_ORDER_BOOTSTRAP_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
      propertyName: "createdate",
    });
  });

  it("replays a safety window after a successful inbound order reconciliation", () => {
    const lastSuccess = "2026-09-25T12:00:00.000Z";
    expect(resolveHubSpotOrderSyncSince(lastSuccess, now)).toBe(
      new Date(
        Date.parse(lastSuccess) - HUBSPOT_ORDER_REPLAY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
  });

  it("replays changes by last modified date after a successful bootstrap", () => {
    const lastSuccess = "2026-09-25T12:00:00.000Z";
    expect(resolveHubSpotOrderSyncWindow(lastSuccess, now)).toEqual({
      since: new Date(
        Date.parse(lastSuccess) - HUBSPOT_ORDER_REPLAY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
      propertyName: "hs_lastmodifieddate",
    });
  });

  it("falls back to the bounded bootstrap window for an invalid timestamp", () => {
    expect(resolveHubSpotOrderSyncSince("not-a-date", now)).toBe(
      new Date(now - HUBSPOT_ORDER_BOOTSTRAP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("uses a short overlap for the release gate after a recent successful sync", () => {
    const lastSuccess = "2026-09-25T17:00:00.000Z";
    expect(resolveHubSpotReleaseOrderSyncWindow(lastSuccess, now)).toEqual({
      since: new Date(
        Date.parse(lastSuccess) - HUBSPOT_ORDER_RELEASE_REPLAY_MINUTES * 60 * 1000,
      ).toISOString(),
      propertyName: "hs_lastmodifieddate",
    });
  });

  it("refuses a release delta when the last successful sync is too old", () => {
    const staleSuccess = new Date(
      now - (HUBSPOT_ORDER_RELEASE_MAX_STALENESS_HOURS + 1) * 60 * 60 * 1000,
    ).toISOString();
    expect(resolveHubSpotReleaseOrderSyncWindow(staleSuccess, now)).toBeNull();
    expect(resolveHubSpotReleaseOrderSyncWindow(null, now)).toBeNull();
  });
});
