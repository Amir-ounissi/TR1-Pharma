import { describe, expect, it } from "vitest";
import {
  HUBSPOT_ORDER_BOOTSTRAP_DAYS,
  HUBSPOT_ORDER_REPLAY_DAYS,
  resolveHubSpotOrderSyncSince,
} from "./reconciliation-window";

describe("HubSpot order reconciliation window", () => {
  const now = Date.parse("2026-09-25T18:00:00.000Z");

  it("bounds the first inbound order reconciliation", () => {
    expect(resolveHubSpotOrderSyncSince(null, now)).toBe(
      new Date(now - HUBSPOT_ORDER_BOOTSTRAP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("replays a safety window after a successful inbound order reconciliation", () => {
    const lastSuccess = "2026-09-25T12:00:00.000Z";
    expect(resolveHubSpotOrderSyncSince(lastSuccess, now)).toBe(
      new Date(
        Date.parse(lastSuccess) - HUBSPOT_ORDER_REPLAY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
  });

  it("falls back to the bounded bootstrap window for an invalid timestamp", () => {
    expect(resolveHubSpotOrderSyncSince("not-a-date", now)).toBe(
      new Date(now - HUBSPOT_ORDER_BOOTSTRAP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
  });
});
