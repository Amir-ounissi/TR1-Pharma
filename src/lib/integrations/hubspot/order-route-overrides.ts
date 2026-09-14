export type HubSpotOrderRouteOverride = "commercial" | "agent";

export function resolveHubSpotOrderRouteOverride(
  configuration: Record<string, unknown> | null,
  userId: string,
): HubSpotOrderRouteOverride | null {
  const rawOverrides = configuration?.order_route_overrides;
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    return null;
  }

  const rawValue = (rawOverrides as Record<string, unknown>)[userId];
  return rawValue === "commercial" || rawValue === "agent" ? rawValue : null;
}
