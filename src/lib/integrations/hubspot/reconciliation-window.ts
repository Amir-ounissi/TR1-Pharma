const DAY_MS = 24 * 60 * 60 * 1000;

export const HUBSPOT_ORDER_BOOTSTRAP_DAYS = 300;
export const HUBSPOT_ORDER_REPLAY_DAYS = 7;

export function resolveHubSpotOrderSyncSince(
  lastSuccessfulInboundSyncAt: string | null | undefined,
  nowMs = Date.now(),
) {
  const bootstrap = () =>
    new Date(nowMs - HUBSPOT_ORDER_BOOTSTRAP_DAYS * DAY_MS).toISOString();

  if (!lastSuccessfulInboundSyncAt) return bootstrap();

  const lastSuccessfulMs = new Date(lastSuccessfulInboundSyncAt).getTime();
  if (!Number.isFinite(lastSuccessfulMs)) return bootstrap();

  return new Date(
    lastSuccessfulMs - HUBSPOT_ORDER_REPLAY_DAYS * DAY_MS,
  ).toISOString();
}
