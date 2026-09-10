import { describe, expect, it } from "vitest";
import {
  attachProposalAssignees,
  getProposalReadinessIssues,
  reviewableProposalStatuses,
} from "./mission-proposals";

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

describe("proposal readiness", () => {
  const completeProposal = {
    assigned_user_id: "00000000-0000-4000-8000-000000000001",
    scheduled_start_at: "2026-09-15T08:00:00.000Z",
    scheduled_end_at: "2026-09-15T12:00:00.000Z",
    budget_estimated_ht: 250,
    objective: "Former l'équipe et soutenir le sell-out.",
    briefing: "Présenter la gamme, respecter le plan merchandising et remonter les ventes.",
    productCount: 3,
  };

  it("allows approval only when the proposal is complete", () => {
    expect(getProposalReadinessIssues(completeProposal)).toEqual([]);
  });

  it("reports every missing approval prerequisite", () => {
    expect(
      getProposalReadinessIssues({
        assigned_user_id: null,
        scheduled_start_at: "2026-09-15T12:00:00.000Z",
        scheduled_end_at: "2026-09-15T08:00:00.000Z",
        budget_estimated_ht: 0,
        objective: "   ",
        briefing: null,
        productCount: 0,
      }),
    ).toEqual(["assignee", "schedule", "budget", "objective", "briefing", "products"]);
  });

  it("accepts numeric budget strings returned by PostgREST", () => {
    expect(getProposalReadinessIssues({ ...completeProposal, budget_estimated_ht: "250.00" })).toEqual([]);
  });
});
