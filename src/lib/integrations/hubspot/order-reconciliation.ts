export type HistoricalHubSpotOrderCandidate = {
  id: string;
  brandPharmacyId: string | null;
  sourceAgentUserId: string | null;
  netAmountHt: number | null;
  orderDate: string | null;
  orderStatus: string | null;
};

type HistoricalHubSpotOrderMatchInput = {
  remoteAmount: number | null;
  remoteDate: string | null;
  brandPharmacyId: string;
  sourceAgentUserId: string | null;
  linkedOrderIds: Set<string>;
  maxDistanceDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function selectHistoricalHubSpotOrderCandidate(
  candidates: HistoricalHubSpotOrderCandidate[],
  input: HistoricalHubSpotOrderMatchInput,
) {
  if (input.remoteAmount === null || !input.remoteDate) return null;
  const remoteMs = new Date(input.remoteDate).getTime();
  if (!Number.isFinite(remoteMs)) return null;

  const maxDistanceMs = (input.maxDistanceDays ?? 7) * DAY_MS;
  const eligible = candidates
    .filter((candidate) => {
      if (input.linkedOrderIds.has(candidate.id)) return false;
      if (candidate.brandPharmacyId !== input.brandPharmacyId) return false;
      if (candidate.orderStatus === "cancelled" || candidate.orderStatus === "draft") return false;
      if (candidate.netAmountHt === null || Math.abs(candidate.netAmountHt - input.remoteAmount!) > 0.01) return false;
      if (!candidate.orderDate) return false;

      const candidateMs = new Date(candidate.orderDate).getTime();
      if (!Number.isFinite(candidateMs) || Math.abs(candidateMs - remoteMs) > maxDistanceMs) return false;

      return !input.sourceAgentUserId
        || !candidate.sourceAgentUserId
        || candidate.sourceAgentUserId === input.sourceAgentUserId;
    })
    .sort((left, right) => {
      const leftDistance = Math.abs(new Date(left.orderDate!).getTime() - remoteMs);
      const rightDistance = Math.abs(new Date(right.orderDate!).getTime() - remoteMs);
      return leftDistance - rightDistance;
    });

  if (eligible.length !== 1) return null;
  return eligible[0].id;
}
