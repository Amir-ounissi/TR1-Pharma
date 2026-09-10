export const reviewableProposalStatuses = ["pending", "needs_correction"] as const;

type ProposalIdentity = { assigned_user_id: string | null };

type UserWithProfile = {
  id: string;
  user_profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

export type ProposalReadinessIssue =
  | "assignee"
  | "schedule"
  | "budget"
  | "objective"
  | "briefing"
  | "products";

export type ProposalReadinessInput = {
  assigned_user_id: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  budget_estimated_ht: number | string | null;
  objective: string | null;
  briefing: string | null;
  productCount: number;
};

export const proposalReadinessLabels: Record<ProposalReadinessIssue, string> = {
  assignee: "intervenant",
  schedule: "créneau valide",
  budget: "budget HT supérieur à 0 €",
  objective: "objectif",
  briefing: "brief",
  products: "au moins un produit",
};

export function getProposalReadinessIssues(input: ProposalReadinessInput): ProposalReadinessIssue[] {
  const issues: ProposalReadinessIssue[] = [];
  const start = input.scheduled_start_at ? new Date(input.scheduled_start_at) : null;
  const end = input.scheduled_end_at ? new Date(input.scheduled_end_at) : null;
  const validSchedule = Boolean(
    start &&
      end &&
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() > start.getTime(),
  );

  if (!input.assigned_user_id) issues.push("assignee");
  if (!validSchedule) issues.push("schedule");
  if (!(Number(input.budget_estimated_ht ?? 0) > 0)) issues.push("budget");
  if (!input.objective?.trim()) issues.push("objective");
  if (!input.briefing?.trim()) issues.push("briefing");
  if (!(input.productCount > 0)) issues.push("products");

  return issues;
}

export function attachProposalAssignees<T extends ProposalIdentity>(proposals: T[], users: UserWithProfile[]) {
  const names = new Map(users.map((user) => {
    const profile = Array.isArray(user.user_profiles) ? user.user_profiles[0] : user.user_profiles;
    return [user.id, profile?.full_name?.trim() || "Intervenant"];
  }));

  return proposals.map((proposal) => ({
    ...proposal,
    assigneeName: (proposal.assigned_user_id ? names.get(proposal.assigned_user_id) : undefined) ?? "Intervenant",
  }));
}
