type BrandRecord = {
  id: string;
  is_active: boolean | null;
  status: string | null;
};

type BrandPharmacyRecord = {
  pharmacy_id: string;
  archived_at: string | null;
};

type MembershipRecord = {
  user_id: string;
};

type OnboardingRecord = {
  id: string;
  brand_id: string;
  brand_name: string;
  status: string;
  created_at: string;
  current_step: string;
  step_statuses: Record<string, string> | null;
};

type MembershipJoin<T> = T | T[] | null;

export type PlatformMembershipRow = {
  id: string;
  status: string;
  created_at: string;
  users: MembershipJoin<{
    id: string;
    email: string;
    user_profiles: MembershipJoin<{ full_name: string | null }>;
  }>;
  roles: MembershipJoin<{ key: string; label: string }>;
  brands: MembershipJoin<{ id: string; name: string }>;
};

export type PlatformDashboardSummary = {
  activeBrands: number;
  preparingBrands: number;
  uniquePharmacies: number;
  brandPharmacyRelations: number;
  uniqueActiveUsers: number;
  onboardingsInProgress: number;
};

export type RecentPlatformOnboarding = {
  id: string;
  brandId: string;
  brandName: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  currentStep: string;
  checklistProgress: string;
};

export type PlatformUserSummary = {
  userId: string;
  fullName: string;
  email: string;
  brands: string[];
  roles: string[];
  statuses: string[];
  createdAt: string;
};

export function summarizePlatformDashboard(input: {
  brands: BrandRecord[];
  brandPharmacies: BrandPharmacyRecord[];
  activeMemberships: MembershipRecord[];
  onboardingSessions: OnboardingRecord[];
}): PlatformDashboardSummary {
  const activeBrands = input.brands.filter((brand) => brand.is_active && brand.status === "active").length;
  const preparingBrands = input.brands.filter((brand) => !brand.is_active || brand.status !== "active").length;
  const activeRelations = input.brandPharmacies.filter((relation) => relation.archived_at == null);
  const uniquePharmacies = new Set(activeRelations.map((relation) => relation.pharmacy_id)).size;
  const uniqueActiveUsers = new Set(input.activeMemberships.map((membership) => membership.user_id)).size;
  const onboardingsInProgress = input.onboardingSessions.filter((session) => session.status !== "completed" && session.status !== "cancelled").length;

  return {
    activeBrands,
    preparingBrands,
    uniquePharmacies,
    brandPharmacyRelations: activeRelations.length,
    uniqueActiveUsers,
    onboardingsInProgress,
  };
}

export function mapRecentPlatformOnboardings(sessions: OnboardingRecord[]): RecentPlatformOnboarding[] {
  return sessions.map((session) => ({
    id: session.id,
    brandId: session.brand_id,
    brandName: session.brand_name,
    status: session.status,
    statusLabel: formatOnboardingStatus(session.status),
    createdAt: session.created_at,
    currentStep: session.current_step,
    checklistProgress: formatChecklistProgress(session.step_statuses),
  }));
}

export function groupPlatformUsers(rows: PlatformMembershipRow[]): PlatformUserSummary[] {
  const grouped = new Map<string, PlatformUserSummary>();

  for (const row of rows) {
    const user = first(row.users);
    if (!user) continue;

    const profile = first(user.user_profiles);
    const role = first(row.roles);
    const brand = first(row.brands);
    const existing = grouped.get(user.id) ?? {
      userId: user.id,
      fullName: profile?.full_name ?? "Invitation en attente",
      email: user.email,
      brands: [],
      roles: [],
      statuses: [],
      createdAt: row.created_at,
    };

    if (brand?.name) {
      pushUnique(existing.brands, brand.name);
    } else if (role?.key === "super_admin") {
      pushUnique(existing.brands, "Plateforme TR1");
    }

    if (role?.label) pushUnique(existing.roles, role.label);
    else if (role?.key) pushUnique(existing.roles, role.key);

    pushUnique(existing.statuses, row.status);
    if (row.created_at < existing.createdAt) existing.createdAt = row.created_at;
    if (existing.fullName === "Invitation en attente" && profile?.full_name) existing.fullName = profile.full_name;

    grouped.set(user.id, existing);
  }

  return [...grouped.values()].sort((left, right) => left.fullName.localeCompare(right.fullName, "fr"));
}

export function formatMembershipStatus(status: string) {
  return ({
    active: "Actif",
    invited: "Invité",
    suspended: "Suspendu",
  } as Record<string, string>)[status] ?? status;
}

function formatOnboardingStatus(status: string) {
  return ({
    in_progress: "En cours",
    ready: "Prêt à activer",
    completed: "Terminé",
    blocked: "Bloqué",
    cancelled: "Annulé",
  } as Record<string, string>)[status] ?? status;
}

function formatChecklistProgress(stepStatuses: Record<string, string> | null) {
  const entries = Object.values(stepStatuses ?? {});
  if (!entries.length) return "0/0";
  const completed = entries.filter((value) => value === "completed").length;
  return `${completed}/${entries.length}`;
}

function first<T>(value: MembershipJoin<T>) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}
