import { describe, expect, it } from "vitest";
import {
  hubSpotCanMutateVisit,
  selectHubSpotVisitCandidate,
  type HubSpotVisitCandidate,
} from "./visit-identity";

const start = "2026-09-25T09:00:00.000Z";

function candidate(overrides: Partial<HubSpotVisitCandidate> & Pick<HubSpotVisitCandidate, "id">): HubSpotVisitCandidate {
  return {
    id: overrides.id,
    scheduledStartAt: overrides.scheduledStartAt ?? start,
    source: overrides.source ?? "manual",
    createdAt: overrides.createdAt ?? "2026-09-24T08:00:00.000Z",
  };
}

describe("HubSpot visit identity", () => {
  it("reuses the best unlinked TR1 visit instead of creating a third candidate", () => {
    const picked = selectHubSpotVisitCandidate(
      [
        candidate({ id: "imported", source: "import" }),
        candidate({ id: "manual", source: "manual" }),
      ],
      new Set(),
      new Date(start).getTime(),
    );

    expect(picked).toBe("manual");
  });

  it("never reuses a TR1 visit already linked to another HubSpot meeting", () => {
    const picked = selectHubSpotVisitCandidate(
      [
        candidate({ id: "already-linked", source: "manual" }),
        candidate({
          id: "free-candidate",
          source: "import",
          scheduledStartAt: "2026-09-25T09:02:00.000Z",
        }),
      ],
      new Set(["already-linked"]),
      new Date(start).getTime(),
    );

    expect(picked).toBe("free-candidate");
  });

  it("lets HubSpot refresh only import-origin visits that TR1 has not taken over", () => {
    expect(hubSpotCanMutateVisit("import", "planned")).toBe(true);
    expect(hubSpotCanMutateVisit("import", "cancelled")).toBe(true);
    expect(hubSpotCanMutateVisit("import", "in_progress")).toBe(false);
    expect(hubSpotCanMutateVisit("import", "completed")).toBe(false);
    expect(hubSpotCanMutateVisit("manual", "planned")).toBe(false);
    expect(hubSpotCanMutateVisit("interaction", "planned")).toBe(false);
  });
});
