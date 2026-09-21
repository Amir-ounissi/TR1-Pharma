import { describe, expect, it } from "vitest";
import { HubSpotApiError } from "./client";
import { hubSpotRunFailureStatus } from "./runtime-status";

describe("HubSpot runtime status policy", () => {
  it("keeps the connector active for record-level and transient failures", () => {
    expect(hubSpotRunFailureStatus(new Error("HubSpot company mapping missing"))).toBe("partial");
    expect(hubSpotRunFailureStatus(new HubSpotApiError("Bad payload", 400, null))).toBe("partial");
    expect(hubSpotRunFailureStatus(new HubSpotApiError("Rate limited", 429, null))).toBe("partial");
    expect(hubSpotRunFailureStatus(new HubSpotApiError("Unavailable", 503, null))).toBe("partial");
  });

  it("marks authentication and authorization failures as connection failures", () => {
    expect(hubSpotRunFailureStatus(new HubSpotApiError("Unauthorized", 401, null))).toBe("failed");
    expect(hubSpotRunFailureStatus(new HubSpotApiError("Forbidden", 403, null))).toBe("failed");
  });
});
