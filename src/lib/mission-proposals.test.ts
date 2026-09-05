import { describe, expect, it } from "vitest";
import { attachProposalAssignees, reviewableProposalStatuses } from "./mission-proposals";

describe("mission proposal presentation", () => {
  it("handles an empty proposal list", () => {
    expect(attachProposalAssignees([], [])).toEqual([]);
  });

  it("keeps pending proposals reviewable", () => {
    expect(reviewableProposalStatuses).toContain("pending");
  });

  it("keeps proposals awaiting correction visible", () => {
    expect(reviewableProposalStatuses).toContain("needs_correction");
  });

  it("matches several proposals to users without a missions-to-users embed", () => {
    const proposals = attachProposalAssignees(
      [
        { id: "proposal-1", assigned_user_id: "user-1" },
        { id: "proposal-2", assigned_user_id: "user-2" },
        { id: "proposal-3", assigned_user_id: null },
      ],
      [
        { id: "user-1", user_profiles: { full_name: "Emma Laurent" } },
        { id: "user-2", user_profiles: [{ full_name: "Léa Moreau" }] },
      ],
    );

    expect(proposals.map((proposal) => proposal.assigneeName)).toEqual(["Emma Laurent", "Léa Moreau", "Intervenant"]);
  });
});
