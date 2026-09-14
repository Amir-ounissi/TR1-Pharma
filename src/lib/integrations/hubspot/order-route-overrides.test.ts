import { describe, expect, it } from "vitest";
import { resolveHubSpotOrderRouteOverride } from "./order-route-overrides";

describe("HubSpot order route overrides", () => {
  it("returns a configured commercial override for a user", () => {
    expect(
      resolveHubSpotOrderRouteOverride(
        { order_route_overrides: { "user-1": "commercial" } },
        "user-1",
      ),
    ).toBe("commercial");
  });

  it("keeps a configured agent override", () => {
    expect(
      resolveHubSpotOrderRouteOverride(
        { order_route_overrides: { "user-2": "agent" } },
        "user-2",
      ),
    ).toBe("agent");
  });

  it("ignores missing or invalid overrides", () => {
    expect(resolveHubSpotOrderRouteOverride(null, "user-1")).toBeNull();
    expect(
      resolveHubSpotOrderRouteOverride(
        { order_route_overrides: { "user-1": "unknown" } },
        "user-1",
      ),
    ).toBeNull();
  });
});
