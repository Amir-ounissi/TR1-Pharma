import { describe, expect, it } from "vitest";
import { sanitizeMarketingProperties } from "./analytics";

describe("marketing analytics", () => {
  it("removes personal data from event properties", () => {
    expect(sanitizeMarketingProperties({ tab: "manager", email: "private@example.com", companyName: "Private", count: 2 })).toEqual({ tab: "manager", count: 2 });
  });
});
