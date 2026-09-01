import franceDepartments from "../data/france-departments-metro.json";
import { labels } from "./reference-data";

export type NetworkMapView = "list" | "map";
export type NetworkMapMode = "network" | "terrain" | "development" | "priorities";
export type NetworkMapPeriod = "7d" | "30d" | "90d" | "ytd";
export type NetworkMapRoleScope = "manager" | "agent";

type DirectoryRow = {
  id: string;
  brand_id: string;
  pharmacy_id: string;
  trade_name: string | null;
  legal_name: string | null;
  city: string | null;
  postal_code: string | null;
  commercial_status: string;
  activity_status: string;
  priority_level: string;
  potential_level: string;
  territory_name: string | null;
  agent_name: string | null;
  pharmacy_group_name: string | null;
  archived_at: string | null;
};

type TimelineRow = {
  brand_pharmacy_id: string;
  event_type: string;
  occurred_at: string;
  title: string | null;
};

type DepartmentFeature = {
  properties: { code: string; nom: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

export type NetworkMapPharmacy = {
  id: string;
  pharmacyId: string;
  name: string;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  commercialStatus: string;
  commercialStatusLabel: string;
  activityStatus: string;
  activityStatusLabel: string;
  priorityLevel: string;
  priorityLevelLabel: string;
  potentialLevel: string;
  potentialLevelLabel: string;
  territoryName: string | null;
  territoryDepartmentCode: string | null;
  territoryRegionCode: string | null;
  agentName: string | null;
  nextActionType: string | null;
  nextActionAt: string | null;
  lastInteractionAt: string | null;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  presentationTone: "neutral" | "accent" | "warning" | "success" | "muted";
  presentationLabel: string;
  presentationReason: string;
  signals: {
    interactionsInPeriod: number;
    missionsInPeriod: number;
    trainingsInPeriod: number;
    animationsInPeriod: number;
    ordersInPeriod: number;
    reordersInPeriod: number;
    hasRecentFieldActivity: boolean;
  };
};

export type NetworkMapActor = {
  key: string;
  name: string;
  pharmacyCount: number;
  latitude: number | null;
  longitude: number | null;
};

export type NetworkMapSummary = {
  visiblePharmacies: number;
  nonGeocodedPharmacies: number;
  activeActors: number;
  actionsInPeriod: number;
  accountsToTreat: number;
  nextActionsPending: number;
  reordersObserved: number;
  prioritiesCount: number;
};

export type NetworkMapDataset = {
  roleScope: NetworkMapRoleScope;
  mode: NetworkMapMode;
  period: NetworkMapPeriod;
  pharmacies: NetworkMapPharmacy[];
  actors: NetworkMapActor[];
  summary: NetworkMapSummary;
};

export type NetworkMapSearch = Record<string, string | string[] | undefined>;

export type MapCoordinate = { latitude: number; longitude: number };

export type ProjectionViewport = {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
};

const departmentCentroids = buildDepartmentCentroidMap();

type QueryResponse = {
  data: unknown[] | null;
  error: Error | null;
};

type QueryBuilder = PromiseLike<QueryResponse> & {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  ilike: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
};

const mapModeLabels: Record<NetworkMapMode, string> = {
  network: "Réseau",
  terrain: "Terrain",
  development: "Développement",
  priorities: "Priorités",
};

export function getMapModeLabel(mode: NetworkMapMode) {
  return mapModeLabels[mode];
}

export function resolveNetworkMapMode(value: string | undefined, roleScope: NetworkMapRoleScope): NetworkMapMode {
  if (roleScope === "agent") {
    return value === "priorities" ? "priorities" : "network";
  }

  if (value === "terrain" || value === "development" || value === "priorities" || value === "network") {
    return value;
  }

  return "network";
}

export function resolveNetworkMapPeriod(value: string | undefined): NetworkMapPeriod {
  if (value === "7d" || value === "30d" || value === "90d" || value === "ytd") {
    return value;
  }

  return "30d";
}

export function getPeriodStart(period: NetworkMapPeriod, now = new Date()) {
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);

  if (period === "ytd") {
    return new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  cursor.setUTCDate(cursor.getUTCDate() - days + 1);
  return cursor;
}

export function buildProjectionViewport(
  coordinates: MapCoordinate[],
  roleScope: NetworkMapRoleScope,
): ProjectionViewport {
  const metropolitanFrance: ProjectionViewport = {
    minLongitude: -5.8,
    maxLongitude: 9.8,
    minLatitude: 41,
    maxLatitude: 51.6,
  };

  if (roleScope === "manager" || coordinates.length === 0) {
    return metropolitanFrance;
  }

  const longitudes = coordinates.map((point) => point.longitude);
  const latitudes = coordinates.map((point) => point.latitude);
  const minLongitude = Math.max(metropolitanFrance.minLongitude, Math.min(...longitudes) - 1.2);
  const maxLongitude = Math.min(metropolitanFrance.maxLongitude, Math.max(...longitudes) + 1.2);
  const minLatitude = Math.max(metropolitanFrance.minLatitude, Math.min(...latitudes) - 0.9);
  const maxLatitude = Math.min(metropolitanFrance.maxLatitude, Math.max(...latitudes) + 0.9);

  return {
    minLongitude,
    maxLongitude: Math.max(maxLongitude, minLongitude + 0.5),
    minLatitude,
    maxLatitude: Math.max(maxLatitude, minLatitude + 0.5),
  };
}

export function projectCoordinate(
  point: MapCoordinate,
  viewport: ProjectionViewport,
  width: number,
  height: number,
  padding = 36,
) {
  const meanLatitudeRadians = ((viewport.minLatitude + viewport.maxLatitude) / 2) * (Math.PI / 180);
  const adjust = Math.cos(meanLatitudeRadians);
  const minX = viewport.minLongitude * adjust;
  const maxX = viewport.maxLongitude * adjust;
  const xSpan = Math.max(0.0001, maxX - minX);
  const ySpan = Math.max(0.0001, viewport.maxLatitude - viewport.minLatitude);
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;
  const scale = Math.min(drawableWidth / xSpan, drawableHeight / ySpan);
  const contentWidth = xSpan * scale;
  const contentHeight = ySpan * scale;
  const offsetX = (width - contentWidth) / 2;
  const offsetY = (height - contentHeight) / 2;

  return {
    x: offsetX + (point.longitude * adjust - minX) * scale,
    y: offsetY + (viewport.maxLatitude - point.latitude) * scale,
  };
}

export async function loadNetworkMapData(args: {
  supabase: {
    from: (...args: unknown[]) => unknown;
  };
  brandId: string;
  roleScope: NetworkMapRoleScope;
  roleKey: string;
  search: NetworkMapSearch;
}) {
  const from = args.supabase.from.bind(args.supabase) as (table: string) => QueryBuilder;
  const period = resolveNetworkMapPeriod(getSingleValue(args.search.period));
  const mode = resolveNetworkMapMode(getSingleValue(args.search.mode), args.roleScope);

  let directoryQuery = from("brand_pharmacy_directory")
    .select("*")
    .eq("brand_id", args.brandId)
    .is("archived_at", null);

  const searchTerm = getSingleValue(args.search.q)?.trim();
  if (searchTerm) {
    directoryQuery = directoryQuery.ilike("search_text", `%${searchTerm}%`);
  }

  for (const [parameter, column] of [
    ["status", "commercial_status"],
    ["activity", "activity_status"],
    ["priority", "priority_level"],
    ["potential", "potential_level"],
  ] as const) {
    const value = getSingleValue(args.search[parameter]);
    if (value && value !== "all") {
      directoryQuery = directoryQuery.eq(column, value);
    }
  }

  for (const [parameter, column] of [
    ["city", "city"],
    ["postalCode", "postal_code"],
    ["agent", "agent_name"],
    ["territory", "territory_name"],
    ["group", "pharmacy_group_name"],
  ] as const) {
    const value = getSingleValue(args.search[parameter]);
    if (value?.trim()) {
      directoryQuery = directoryQuery.ilike(column, `%${value.trim()}%`);
    }
  }

  const { data: directoryRowsRaw, error: directoryError } = await directoryQuery.order("trade_name", { ascending: true });
  if (directoryError) {
    throw directoryError;
  }

  const directoryRows = (directoryRowsRaw ?? []) as DirectoryRow[];
  if (!directoryRows.length) {
    return {
      roleScope: args.roleScope,
      roleKey: args.roleKey,
      mode,
      period,
      pharmacies: [],
      actors: [],
      summary: emptySummary(),
    };
  }

  const pharmacies = directoryRows.flatMap((directoryRow) => {
    const signals = buildSignals([]);
    const presentation = classifyPharmacyPresentation({
      mode,
      commercialStatus: directoryRow.commercial_status,
      activityStatus: directoryRow.activity_status,
      priorityLevel: directoryRow.priority_level,
      potentialLevel: directoryRow.potential_level,
      hasNextAction: false,
      signals,
      firstOrderAt: null,
    });
    const approximateCoordinate = getApproximateCoordinateFromPostalCode(directoryRow.postal_code);

    return [{
      id: directoryRow.id,
      pharmacyId: directoryRow.pharmacy_id,
      name: directoryRow.trade_name || directoryRow.legal_name || "Pharmacie",
      city: directoryRow.city || null,
      postalCode: directoryRow.postal_code || null,
      latitude: approximateCoordinate?.latitude ?? null,
      longitude: approximateCoordinate?.longitude ?? null,
      commercialStatus: directoryRow.commercial_status,
      commercialStatusLabel: labels.commercialStatus[directoryRow.commercial_status as keyof typeof labels.commercialStatus] ?? directoryRow.commercial_status,
      activityStatus: directoryRow.activity_status,
      activityStatusLabel: labels.activityStatus[directoryRow.activity_status as keyof typeof labels.activityStatus] ?? directoryRow.activity_status,
      priorityLevel: directoryRow.priority_level,
      priorityLevelLabel: labels.priorityLevel[directoryRow.priority_level as keyof typeof labels.priorityLevel] ?? directoryRow.priority_level,
      potentialLevel: directoryRow.potential_level,
      potentialLevelLabel: labels.potentialLevel[directoryRow.potential_level as keyof typeof labels.potentialLevel] ?? directoryRow.potential_level,
      territoryName: directoryRow.territory_name || null,
      territoryDepartmentCode: inferDepartmentCode(directoryRow.postal_code),
      territoryRegionCode: null,
      agentName: directoryRow.agent_name ?? null,
      nextActionType: null,
      nextActionAt: null,
      lastInteractionAt: null,
      lastOrderAt: null,
      firstOrderAt: null,
      presentationTone: presentation.tone,
      presentationLabel: presentation.label,
      presentationReason: presentation.reason,
      signals,
    }] satisfies NetworkMapPharmacy[];
  });

  const actors = buildActorMarkers(pharmacies);
  const summary = buildSummary(pharmacies, actors);

  return {
    roleScope: args.roleScope,
    roleKey: args.roleKey,
    mode,
    period,
    pharmacies,
    actors,
    summary,
  } satisfies NetworkMapDataset & { roleKey: string };
}

function getSingleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function buildSignals(events: TimelineRow[]) {
  const interactionsInPeriod = events.filter((event) => event.event_type === "interaction").length;
  const missions = events.filter((event) => event.event_type === "mission");
  const animationsInPeriod = missions.filter((event) => (event.title ?? "").toLowerCase().includes("animation")).length;
  const trainingsInPeriod = missions.filter((event) => (event.title ?? "").toLowerCase().includes("formation")).length;
  const orders = events.filter((event) => event.event_type === "order");
  const reordersInPeriod = orders.filter((event) => (event.title ?? "").toLowerCase().includes("réassort")).length;

  return {
    interactionsInPeriod,
    missionsInPeriod: missions.length,
    trainingsInPeriod,
    animationsInPeriod,
    ordersInPeriod: orders.length,
    reordersInPeriod,
    hasRecentFieldActivity: interactionsInPeriod + missions.length > 0,
  };
}

function classifyPharmacyPresentation(input: {
  mode: NetworkMapMode;
  commercialStatus: string;
  activityStatus: string;
  priorityLevel: string;
  potentialLevel: string;
  hasNextAction: boolean;
  signals: NetworkMapPharmacy["signals"];
  firstOrderAt: string | null;
}) {
  if (input.mode === "terrain") {
    if (input.signals.trainingsInPeriod > 0) return { tone: "accent", label: "Formation", reason: "Formation observée sur la période." } as const;
    if (input.signals.animationsInPeriod > 0) return { tone: "accent", label: "Animation", reason: "Animation observée sur la période." } as const;
    if (input.signals.missionsInPeriod > 0) return { tone: "success", label: "Mission", reason: "Mission terrain réalisée sur la période." } as const;
    if (input.signals.interactionsInPeriod > 0) return { tone: "success", label: "Visite / contact", reason: "Interaction commerciale observée sur la période." } as const;
    return { tone: "muted", label: "Aucune activité", reason: "Aucun signal terrain récent sur la période." } as const;
  }

  if (input.mode === "development") {
    if (["targeted", "qualified", "contacted", "appointment_scheduled", "offer_sent"].includes(input.commercialStatus)) {
      return { tone: "accent", label: "Prospect / ciblée", reason: "Compte en cours de développement commercial." } as const;
    }
    if (input.commercialStatus === "pending_order") {
      return { tone: "warning", label: "Commande attendue", reason: "Une première commande ou un réassort est attendu." } as const;
    }
    if (input.commercialStatus === "implanted" && !input.firstOrderAt) {
      return { tone: "warning", label: "Ouverture récente", reason: "Implantation récente à consolider." } as const;
    }
    if (input.commercialStatus === "to_develop" || input.potentialLevel === "high" || input.potentialLevel === "very_high") {
      return { tone: "accent", label: "À développer", reason: "Potentiel élevé ou compte à développer." } as const;
    }
  }

  if (input.mode === "priorities") {
    if (!input.hasNextAction && input.priorityLevel === "strategic") {
      return { tone: "warning", label: "Stratégique sans action", reason: "Compte stratégique sans prochaine action planifiée." } as const;
    }
    if (!input.hasNextAction) {
      return { tone: "warning", label: "Sans prochaine action", reason: "Aucune prochaine action enregistrée." } as const;
    }
    if (input.activityStatus === "at_risk") {
      return { tone: "warning", label: "À risque", reason: "Santé commerciale à surveiller." } as const;
    }
    if (input.activityStatus === "dormant") {
      return { tone: "warning", label: "Dormante", reason: "Compte dormant à relancer." } as const;
    }
    if (input.signals.reordersInPeriod > 0) {
      return { tone: "success", label: "Réassort observé", reason: "Réassort observé sur la période." } as const;
    }
  }

  if (input.commercialStatus === "active" || input.commercialStatus === "implanted") {
    return { tone: "success", label: "Active", reason: "Compte ouvert et suivi." } as const;
  }
  if (input.commercialStatus === "dormant") {
    return { tone: "warning", label: "Dormante", reason: "Compte sans dynamique récente." } as const;
  }
  if (input.priorityLevel === "strategic") {
    return { tone: "accent", label: "Stratégique", reason: "Compte stratégique." } as const;
  }

  return { tone: "neutral", label: "Réseau", reason: "Compte visible dans votre périmètre autorisé." } as const;
}

function buildActorMarkers(pharmacies: NetworkMapPharmacy[]): NetworkMapActor[] {
  const grouped = new Map<string, { name: string; coordinates: MapCoordinate[] }>();
  for (const pharmacy of pharmacies) {
    if (!pharmacy.agentName || pharmacy.latitude == null || pharmacy.longitude == null) continue;
    const bucket = grouped.get(pharmacy.agentName) ?? { name: pharmacy.agentName, coordinates: [] };
    bucket.coordinates.push({ latitude: pharmacy.latitude, longitude: pharmacy.longitude });
    grouped.set(pharmacy.agentName, bucket);
  }

  return [...grouped.entries()].map(([key, value]) => {
    const latitude = value.coordinates.length
      ? value.coordinates.reduce((sum, point) => sum + point.latitude, 0) / value.coordinates.length
      : null;
    const longitude = value.coordinates.length
      ? value.coordinates.reduce((sum, point) => sum + point.longitude, 0) / value.coordinates.length
      : null;
    return {
      key,
      name: value.name,
      pharmacyCount: value.coordinates.length,
      latitude,
      longitude,
    };
  });
}

function buildSummary(pharmacies: NetworkMapPharmacy[], actors: NetworkMapActor[]): NetworkMapSummary {
  return {
    visiblePharmacies: pharmacies.length,
    nonGeocodedPharmacies: pharmacies.filter((pharmacy) => pharmacy.latitude == null || pharmacy.longitude == null).length,
    activeActors: actors.length,
    actionsInPeriod: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.signals.interactionsInPeriod + pharmacy.signals.missionsInPeriod, 0),
    accountsToTreat: pharmacies.filter((pharmacy) => pharmacy.presentationTone === "warning" || pharmacy.presentationTone === "accent").length,
    nextActionsPending: pharmacies.filter((pharmacy) => Boolean(pharmacy.nextActionAt)).length,
    reordersObserved: pharmacies.filter((pharmacy) => pharmacy.signals.reordersInPeriod > 0).length,
    prioritiesCount: pharmacies.filter((pharmacy) => pharmacy.priorityLevel === "strategic" || pharmacy.priorityLevel === "high").length,
  };
}

function emptySummary(): NetworkMapSummary {
  return {
    visiblePharmacies: 0,
    nonGeocodedPharmacies: 0,
    activeActors: 0,
    actionsInPeriod: 0,
    accountsToTreat: 0,
    nextActionsPending: 0,
    reordersObserved: 0,
    prioritiesCount: 0,
  };
}

export function inferDepartmentCode(postalCode: string | null) {
  if (!postalCode) {
    return null;
  }

  const normalized = postalCode.trim();
  if (normalized.length < 2) {
    return null;
  }

  if (normalized.startsWith("20")) {
    return "2A";
  }

  return normalized.slice(0, 2);
}

export function getApproximateCoordinateFromPostalCode(postalCode: string | null) {
  const departmentCode = inferDepartmentCode(postalCode);
  if (!departmentCode) {
    return null;
  }

  return departmentCentroids.get(departmentCode) ?? null;
}

function buildDepartmentCentroidMap() {
  const features = (franceDepartments as { features: DepartmentFeature[] }).features;
  return new Map(
    features
      .map((feature) => {
        const centroid = computeFeatureCentroid(feature);
        return centroid ? [feature.properties.code, centroid] : null;
      })
      .filter(Boolean) as Array<[string, MapCoordinate]>,
  );
}

function computeFeatureCentroid(feature: DepartmentFeature): MapCoordinate | null {
  const coordinates = flattenGeometryCoordinates(feature.geometry);
  if (!coordinates.length) {
    return null;
  }

  const totals = coordinates.reduce(
    (accumulator, [longitude, latitude]) => ({
      latitude: accumulator.latitude + latitude,
      longitude: accumulator.longitude + longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: totals.latitude / coordinates.length,
    longitude: totals.longitude / coordinates.length,
  };
}

function flattenGeometryCoordinates(geometry: DepartmentFeature["geometry"]) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.flat() as number[][];
  }

  return geometry.coordinates.flat(2) as number[][];
}
