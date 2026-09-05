export const reviewableProposalStatuses = ["pending", "needs_correction"] as const;

type ProposalIdentity = { assigned_user_id: string | null };

type UserWithProfile = {
  id: string;
  user_profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

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
