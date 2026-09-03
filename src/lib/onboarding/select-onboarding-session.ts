type OnboardingSession = {
  brand_id: string;
};

export function selectOnboardingSession<T extends OnboardingSession>(
  sessions: T[] | null | undefined,
  brandId: string | undefined,
): T | null {
  if (!brandId) return null;
  return sessions?.find((session) => session.brand_id === brandId) ?? null;
}
