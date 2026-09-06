import { describe, expect, it } from "vitest";
import {
  canAutomaticallyResolveConnectorConflict,
  connectorSyncDedupeKey,
  expandConnectorMapping,
} from "./connectors-runtime";

describe("connector sync runtime planning", () => {
  const base = {
    connectionId: "00000000-0000-0000-0000-000000000001",
    provider: "hubspot" as const,
    entityType: "pharmacies" as const,
    externalObject: " companies ",
    conflictStrategy: "manual" as const,
    mappingProfileId: null,
    cursorField: " updatedAt ",
    isEnabled: true,
  };

  it("expands a bidirectional mapping into two explicit trusted-backend runs", () => {
    expect(expandConnectorMapping({ ...base, direction: "bidirectional" })).toEqual([
      expect.objectContaining({ direction: "inbound", externalObject: "companies", cursorField: "updatedAt" }),
      expect.objectContaining({ direction: "outbound", externalObject: "companies", cursorField: "updatedAt" }),
    ]);
  });

  it("does not schedule disabled mappings", () => {
    expect(expandConnectorMapping({ ...base, direction: "inbound", isEnabled: false })).toEqual([]);
  });

  it("builds a stable dedupe key per connection, object and direction", () => {
    const [plan] = expandConnectorMapping({ ...base, direction: "inbound" });
    expect(connectorSyncDedupeKey(plan)).toBe("00000000-0000-0000-0000-000000000001:pharmacies:companies:inbound");
  });

  it("keeps manual conflicts out of automatic resolution", () => {
    expect(canAutomaticallyResolveConnectorConflict("manual")).toBe(false);
    expect(canAutomaticallyResolveConnectorConflict("external_wins")).toBe(true);
    expect(canAutomaticallyResolveConnectorConflict("tr1_wins")).toBe(true);
    expect(canAutomaticallyResolveConnectorConflict("newest_wins")).toBe(true);
  });
});
