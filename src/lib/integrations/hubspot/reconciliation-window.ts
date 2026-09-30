const DAY_MS = 24 * 60 * 60 * 1000;

export const HUBSPOT_ORDER_BOOTSTRAP_DAYS = 300;
export const HUBSPOT_ORDER_REPLAY_DAYS = 7;
export const HUBSPOT_ORDER_RELEASE_REPLAY_MINUTES = 15;
export const HUBSPOT_ORDER_RELEASE_MAX_STALENESS_HOURS = 24;

export type HubSpotOrderSyncWindow = {
  since: string;
  propertyName: "createdate" | "hs_lastmodifieddate";
};

export function resolveHubSpotOrderSyncWindow(
  lastSuccessfulInboundSyncAt: string | null | undefined,
  nowMs = Date.now(),
): HubSpotOrderSyncWindow {
  const bootstrap = (): HubSpotOrderSyncWindow => ({
    since: new Date(nowMs - HUBSPOT_ORDER_BOOTSTRAP_DAYS * DAY_MS).toISOString(),
    propertyName: "createdate",
  });

  if (!lastSuccessfulInboundSyncAt) return bootstrap();

  const lastSuccessfulMs = new Date(lastSuccessfulInboundSyncAt).getTime();
  if (!Number.isFinite(lastSuccessfulMs)) return bootstrap();

  return {
    since: new Date(
      lastSuccessfulMs - HUBSPOT_ORDER_REPLAY_DAYS * DAY_MS,
    ).toISOString(),
    propertyName: "hs_lastmodifieddate",
  };
}

export function resolveHubSpotOrderSyncSince(
  lastSuccessfulInboundSyncAt: string | null | undefined,
  nowMs = Date.now(),
) {
  return resolveHubSpotOrderSyncWindow(lastSuccessfulInboundSyncAt, nowMs).since;
}


export function resolveHubSpotReleaseOrderSyncWindow(
  lastSuccessfulInboundSyncAt: string | null | undefined,
  nowMs = Date.now(),
): HubSpotOrderSyncWindow | null {
  if (!lastSuccessfulInboundSyncAt) return null;

  const lastSuccessfulMs = new Date(lastSuccessfulInboundSyncAt).getTime();
  if (!Number.isFinite(lastSuccessfulMs)) return null;

  const maxStalenessMs =
    HUBSPOT_ORDER_RELEASE_MAX_STALENESS_HOURS * 60 * 60 * 1000;
  if (nowMs - lastSuccessfulMs > maxStalenessMs) return null;

  return {
    since: new Date(
      lastSuccessfulMs - HUBSPOT_ORDER_RELEASE_REPLAY_MINUTES * 60 * 1000,
    ).toISOString(),
    propertyName: "hs_lastmodifieddate",
  };
}
